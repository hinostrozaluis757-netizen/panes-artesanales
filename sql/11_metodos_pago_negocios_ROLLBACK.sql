-- ARCHIVO: sql/11_metodos_pago_negocios_ROLLBACK.sql
-- =============================================================================
-- ROLLBACK DE MÉTODOS DE PAGO POR NEGOCIO (sql/11_metodos_pago_negocios.sql)
-- =============================================================================
-- ADVERTENCIA CRÍTICA:
-- Al ejecutar este script se eliminará la tabla public.negocios_pagos y se
-- BORRARÁN TODOS LOS DATOS DE PAGO (Yape, Plin, BCP, BBVA y titular) cargados
-- para todos los negocios. Haz un respaldo antes de ejecutarlo en el SQL Editor.
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_auditoria_negocios_pagos ON public.negocios_pagos;
DROP FUNCTION IF EXISTS public.fn_auditoria_negocios_pagos();

DROP TRIGGER IF EXISTS trg_negocios_pagos_updated_at ON public.negocios_pagos;
DROP FUNCTION IF EXISTS public.fn_negocios_pagos_updated_at();

REVOKE ALL ON FUNCTION public.obtener_metodos_pago(uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.obtener_metodos_pago(uuid);

DROP POLICY IF EXISTS "owner_select_pagos" ON public.negocios_pagos;
DROP POLICY IF EXISTS "owner_insert_pagos" ON public.negocios_pagos;
DROP POLICY IF EXISTS "owner_update_pagos" ON public.negocios_pagos;
DROP POLICY IF EXISTS "superadmin_select_pagos" ON public.negocios_pagos;

DROP TABLE IF EXISTS public.negocios_pagos;

COMMIT;
