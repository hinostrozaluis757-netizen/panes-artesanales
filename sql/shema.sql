-- =====================================================
-- TABLA: pedidos
-- =====================================================
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido bigint generated always as identity (start with 1001),
  fecha timestamptz not null default now(),
  cliente_nombre text not null,
  cliente_telefono text not null,
  tipo_entrega text not null check (tipo_entrega in ('Delivery','Recojo en local','Consumo en local')),
  direccion text,
  metodo_pago text not null,
  total numeric(10,2) not null check (total >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','cancelado','entregado')),
  comprobante_url text,
  notas text,
  created_at timestamptz default now()
);

create index idx_pedidos_fecha on pedidos(fecha desc);
create index idx_pedidos_estado on pedidos(estado);
create index idx_pedidos_telefono on pedidos(cliente_telefono);

-- =====================================================
-- TABLA: pedido_items
-- =====================================================
create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  producto_id text,
  producto_nombre text not null,
  precio_unitario numeric(10,2) not null,
  cantidad int not null check (cantidad > 0),
  subtotal numeric(10,2) not null,
  created_at timestamptz default now()
);

create index idx_items_pedido on pedido_items(pedido_id);
create index idx_items_producto on pedido_items(producto_nombre);

-- =====================================================
-- RLS: seguridad
-- =====================================================
alter table pedidos enable row level security;
alter table pedido_items enable row level security;

-- INSERT público (clientes anónimos pueden crear pedidos)
create policy "anon_insert_pedidos"
  on pedidos for insert to anon, authenticated
  with check (true);

create policy "anon_insert_items"
  on pedido_items for insert to anon, authenticated
  with check (true);

-- SELECT solo para usuarios autenticados (admin)
create policy "auth_select_pedidos"
  on pedidos for select to authenticated
  using (true);

create policy "auth_select_items"
  on pedido_items for select to authenticated
  using (true);

-- UPDATE solo autenticados (cambiar estado)
create policy "auth_update_pedidos"
  on pedidos for update to authenticated
  using (true)
  with check (true);

-- =====================================================
-- VISTAS DE REPORTES (opcional pero útil)
-- =====================================================
create or replace view v_ventas_diarias as
select
  date(fecha at time zone 'America/Lima') as dia,
  count(*) as num_pedidos,
  sum(total) as ingresos
from pedidos
where estado in ('pagado','entregado')
group by 1
order by 1 desc;

create or replace view v_top_productos as
select
  pi.producto_nombre,
  sum(pi.cantidad) as total_vendido,
  sum(pi.subtotal) as ingresos
from pedido_items pi
join pedidos p on p.id = pi.pedido_id
where p.estado in ('pagado','entregado')
group by 1
order by 2 desc;