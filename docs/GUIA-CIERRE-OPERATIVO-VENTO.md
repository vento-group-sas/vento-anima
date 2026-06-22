# Guia de cierre operativo Vento

> Objetivo: dejar inventarios, remisiones, produccion y ventas listos para operar sin duplicar datos ni romper la separacion entre producto operativo, receta, remision y producto comercial.
> Estado: borrador de trabajo.
> Ultima actualizacion: 2026-06-22.

## Principio central

Vento no debe resolver ventas duplicando productos. La cadena correcta es:

1. Producto operativo: define que existe y como se mide.
2. Receta o consumo: define que insumos descuenta y desde donde.
3. Configuracion por sede: define donde se produce, remite, vende o consume.
4. Remision: mueve producto terminado o insumos entre sedes cuando aplica.
5. Producto comercial: define nombre de venta, precio, categoria, imagen y experiencia cliente.

El precio vive en el producto comercial. El producto operativo no debe tener precio de venta.

## 1. Inventarios

### Falta por implementar o cerrar

- Auditar productos operativos activos por sede.
- Separar productos comprados, insumos, preparaciones internas y preparaciones vendibles.
- Confirmar unidad de inventario por producto y conversiones de entrada.
- Completar ubicaciones LOC por sede, area y producto critico.
- Definir politica de stock por producto:
  - stock estricto
  - bajo pedido
  - produccion local
  - remision desde otra sede
- Completar stock inicial confiable por sede y LOC.
- Definir responsables de ajuste y conteo.
- Agregar reportes basicos de diferencias, movimientos y productos sin configuracion.

### Como hacerlo

1. En Nexo, crear o depurar el producto operativo.
2. Asignar tipo, unidad base, unidad de stock y estado activo.
3. Configurar `product_site_settings` por sede:
   - activo en sede
   - produce localmente o no
   - remision habilitada o no
   - ubicacion de produccion cuando aplique
   - vendible solo si corresponde
4. Cargar ubicaciones LOC para productos que requieren trazabilidad fina.
5. Ejecutar una auditoria de datos:
   - productos sin unidad
   - productos activos sin sede
   - productos vendibles sin configuracion comercial
   - productos con remision habilitada sin origen claro

### Definition of Done

- Cada producto operativo activo tiene unidad, tipo, sede y politica operativa.
- El stock inicial esta cargado o marcado explicitamente como no requerido.
- No hay productos comerciales apuntando a productos operativos inactivos.
- Los productos criticos tienen LOC definido cuando el inventario lo exige.

## 2. Produccion

### Falta por implementar o cerrar

- Completar recetas de productos preparados.
- Bloquear ciclos de recetas en todos los flujos de edicion, no solo en creacion.
- Definir si una receta es compartida o especifica por sede/area.
- Crear una capa de publicacion o alcance para recetas compartidas si se quiere evitar duplicarlas.
- Definir consumo por modalidad:
  - producto terminado almacenado
  - preparado al momento
  - extra directo
- Validar costo teorico de receta contra insumos reales.
- Definir origen de consumo por LOC o area.

### Como hacerlo

1. Crear el producto operativo de salida.
2. Crear receta en Fogo con componentes activos y cantidades normalizadas.
3. Validar que no exista autorreferencia directa o indirecta.
4. Asociar la receta a sede, area o alcance compartido.
5. Para recetas iguales en varias sedes, no duplicar producto si el consumo es realmente igual. Publicar la misma receta a varias sedes cuando exista la capa de alcance.
6. Si cambia el metodo o consumo real, crear producto/receta diferente.

### Definition of Done

- Todo producto preparado vendible o remitible tiene receta o una decision documentada de no requerirla.
- Las recetas no pueden crear ciclos.
- La sede sabe si consume insumos al vender, al producir o al recibir remision.
- Los costos teoricos son visibles para control operativo.

## 3. Remisiones

### Falta por implementar o cerrar

- Confirmar origen de produccion por producto y sede destino.
- Configurar productos remitibles por sede destino.
- Mantener categorias de remision como agrupacion visual por sede destino, no como categoria de catalogo.
- Aplicar movimientos por LOC en envio y recepcion cuando el producto lo requiera.
- Hacer idempotentes los RPC de envio y recepcion para evitar dobles descuentos.
- Definir politica de bajo pedido para productos que pueden solicitarse con stock actual en cero.
- Mejorar reportes de faltantes, diferencias y recepciones parciales.

### Como hacerlo

1. En Nexo, activar remision por sede destino en `product_site_settings`.
2. Configurar categoria visual de remision por sede destino.
3. Definir sede origen o area productora.
4. Crear solicitud de remision con fecha esperada, cantidades y origen.
5. En preparacion, registrar cantidad preparada.
6. En envio, descontar origen una sola vez.
7. En recepcion, sumar destino una sola vez y registrar faltantes.
8. Para productos bajo pedido, permitir solicitud aunque stock actual sea cero.

### Definition of Done

- La pantalla de remision muestra productos agrupados por sede destino.
- El envio y la recepcion no duplican movimientos si se reintentan.
- Los productos bajo pedido no quedan bloqueados por stock cero.
- Los faltantes quedan registrados y visibles.

## 4. Ventas

### Falta por implementar o cerrar

- Completar catalogo comercial por sede.
- Mapear ventas externas usando identificadores estables, no nombres.
- Persistir MID o `external_item_id` para integraciones como Makos.
- Separar importacion de ventas de aplicacion de inventario.
- Definir reglas de consumo para cada venta:
  - descuenta producto terminado
  - descuenta receta al momento
  - descuenta extra directo
- Crear conciliacion entre ventas, productos comerciales y productos operativos.
- Definir que modulo aplica inventario despues de validar ventas.

### Como hacerlo

1. Crear producto operativo y receta si aplica.
2. Marcar venta habilitada por sede con `sales_enabled` cuando sea una preparacion vendible.
3. Crear producto comercial en Viso/Pass con precio por sede.
4. Asociar el producto comercial al producto operativo.
5. Configurar personalizaciones y reglas de consumo.
6. Para ventas importadas, guardar raw sales primero.
7. Mapear por MID antes que por codigo o nombre.
8. Aplicar inventario solo cuando la venta este validada.

### Definition of Done

- Todo item comercial apunta a un producto operativo valido.
- El precio es por sede en la capa comercial.
- Las ventas importadas se pueden reprocesar sin remapear manualmente.
- El inventario se afecta desde una regla validada, no desde la importacion cruda.

## Orden recomendado de implementacion

1. Auditoria de productos operativos y sedes.
2. Configuracion minima de inventario por producto.
3. Recetas y reglas de consumo.
4. Remisiones por sede destino.
5. Menu comercial y precios por sede.
6. Importacion de ventas y mapeo externo.
7. Aplicacion controlada de inventario.
8. Reportes operativos y alertas de datos incompletos.

## Preguntas que necesito cerrar contigo

1. Lista final de sedes que salen en la primera version.
2. Lista de productos que se venden en cada sede.
3. Para cada producto vendible: se produce local, se remite o se compra listo.
4. Para cada producto preparado: receta exacta, unidad y merma esperada.
5. Productos bajo pedido que deben poder solicitarse con stock cero.
6. Integraciones de ventas que entran en primera version: Makos, Pass, Shopify u otras.
7. Quien sera responsable de aprobar ajustes de inventario y diferencias de remision.
8. Que reportes son obligatorios para operar el primer mes.

