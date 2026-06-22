# Guia de lanzamiento Vento Pass

> Objetivo: ordenar lo que falta para lanzar Vento Pass como app cliente conectada al catalogo real, sedes reales, productos operativos, remisiones, personalizaciones y ventas.
> Estado: borrador de trabajo.
> Ultima actualizacion: 2026-06-22.

## Principio central

Vento Pass no debe inventar productos. Pass consume el menu comercial, y ese menu debe estar respaldado por productos operativos configurados en el ecosistema Vento.

La secuencia correcta para cada producto es:

1. Crear producto operativo.
2. Crear receta si es preparacion.
3. Configurar produccion, remision o abastecimiento por sede.
4. Habilitar venta por sede si aplica.
5. Crear producto comercial con precio, imagen, categoria y copy.
6. Configurar personalizaciones.
7. Validar que Pass lo muestra y que checkout genera consumo correcto.

## 1. Producto operativo por sede

### Falta

- Crear todos los productos operativos necesarios para las sedes de lanzamiento.
- Marcar cuales son:
  - producto comprado
  - insumo
  - preparacion interna
  - preparacion vendible
  - producto terminado remitido
- Configurar unidad, sede, estado y ubicacion de produccion.
- Activar `sales_enabled` solo para preparaciones que pueden venderse.

### Como hacerlo

1. Crear producto en Nexo.
2. Completar unidad base y unidad de stock.
3. Configurar sedes donde existe.
4. Si es preparacion vendible, mantenerlo sin precio operativo y habilitar venta por sede.
5. Validar que aparece en `pass.sell_products_by_site` para la sede correcta.

### Riesgo si se omite

El menu comercial podria quedar bonito en Pass, pero sin trazabilidad real de inventario, produccion o costo.

## 2. Recetas y consumo

### Falta

- Crear recetas de todas las preparaciones vendibles.
- Definir extras y personalizaciones que afectan inventario.
- Definir consumo por opcion:
  - agregar insumo
  - quitar ingrediente
  - cambiar componente
  - no afectar inventario
- Validar costo teorico por producto.

### Como hacerlo

1. Crear receta base en Fogo.
2. Asociar componentes, cantidades y unidades.
3. Evitar recetas duplicadas si el consumo es igual entre sedes.
4. Crear reglas de consumo para opciones de Pass:
   - topping extra
   - leche alternativa
   - quitar ingrediente
   - cambio de tamano
5. Probar que checkout puede construir la orden sin reglas incompletas.

### Riesgo si se omite

Pass vendera productos que no descuentan correctamente inventario o que generan costos teoricos falsos.

## 3. Remisiones para productos vendidos en Pass

### Falta

- Identificar productos que se venden en una sede pero se producen en otra.
- Configurar remision por sede destino.
- Definir si el producto puede pedirse bajo pedido con stock cero.
- Crear categorias visuales de remision por sede destino.
- Confirmar envio, recepcion y faltantes.

### Como hacerlo

1. En Nexo, activar remision para el producto en la sede destino.
2. Configurar categoria visual de remision para esa sede.
3. Definir origen productor.
4. Validar flujo completo:
   - solicitud
   - preparacion
   - envio
   - recepcion
   - disponibilidad para venta
5. Si Pass permite comprar bajo pedido, documentar tiempo de preparacion y disponibilidad.

### Riesgo si se omite

Pass podria vender productos que la sede no puede producir ni recibir a tiempo.

## 4. Producto comercial en Viso

### Falta

- Crear item comercial por producto y sede.
- Asignar precio por sede.
- Completar nombre, descripcion, imagen, categoria y coleccion.
- Configurar layout de tarjeta interna.
- Activar o pausar por sede.
- Evitar duplicados comerciales para el mismo producto operativo en la misma sede.

### Como hacerlo

1. En Viso, ir a menu comercial.
2. Crear producto comercial.
3. Seleccionar sede.
4. Seleccionar producto operativo desde `pass.sell_products_by_site`.
5. Asignar estructura comercial:
   - coleccion
   - categoria
   - orden
   - destacado si aplica
6. Definir precio comercial.
7. Guardar y pasar a personalizaciones.

### Riesgo si se omite

El producto puede existir en inventario, pero no aparecer en Pass o aparecer sin precio/categoria correcta.

## 5. Tarjetas internas y experiencia visual

### Falta

- Terminar el proceso visual de tarjetas internas.
- Definir layouts por tipo de producto:
  - compacto
  - destacado
  - detalle con personalizaciones
  - producto bajo pedido
- Completar imagenes reales de producto.
- Definir badges operativos:
  - nuevo
  - recomendado
  - bajo pedido
  - limitado
  - agotado
- Alinear el diseno de la tarjeta con disponibilidad real, no solo con marketing.

### Como hacerlo

1. Usar `catalog_item_presentation` para definir superficie `vento_pass_menu`.
2. Guardar `card_layout`, destacado y peso visual.
3. Cargar imagen principal y assets de opciones.
4. En Pass, validar:
   - lista de productos
   - detalle
   - personalizaciones
   - carrito
   - checkout
5. Revisar que texto largo, imagenes y precios no rompan mobile.

### Riesgo si se omite

El catalogo queda funcional pero no confiable visualmente para compra real.

## 6. Personalizaciones

### Falta

- Configurar grupos de opciones por producto.
- Crear opciones con precio adicional cuando aplique.
- Asociar opcion a producto o ingrediente cuando afecta inventario.
- Cargar assets visuales de opciones.
- Definir minimos, maximos y obligatoriedad.
- Probar combinaciones invalidas.

### Como hacerlo

1. Desde Viso, editar el producto comercial.
2. Crear grupos:
   - tamano
   - leche
   - toppings
   - quitar ingredientes
   - extras
3. Definir seleccion simple o multiple.
4. Crear reglas de consumo por opcion.
5. Confirmar que Pass renderiza la opcion y que checkout la persiste.

### Riesgo si se omite

El cliente puede comprar variantes que no existen operativamente o que no descuentan insumos.

## 7. Pedidos y checkout

### Falta

- Definir alcance del MVP:
  - pickup
  - delivery
  - programado
  - pago externo o contra entrega
- Pulir `Mis pedidos`.
- Crear o cerrar pantalla de detalle de pedido si la lista actual queda pesada.
- Definir estados visibles para cliente con lenguaje no tecnico.
- Validar que orden, items, opciones, total y sede quedan persistidos.

### Como hacerlo

1. Priorizar "Pedir ahora" como flujo comercial si el lanzamiento depende de venta.
2. Mantener Pass, Club y experiencias como capas alrededor del motor de pedidos.
3. Traducir estados tecnicos a copy cliente.
4. Probar orden completa en cada sede de lanzamiento.
5. Validar que el pedido puede pasar a preparacion operativa.

### Riesgo si se omite

La app puede mostrar menu, pero no cerrar venta confiable ni dar seguimiento entendible.

## 8. Datos de lanzamiento

### Falta

- Lista final de sedes.
- Horarios por sede.
- Disponibilidad por producto y sede.
- Imagenes principales.
- Imagenes de opciones.
- Precios finales.
- Colecciones y categorias comerciales.
- Productos pausados para lanzamiento.
- Textos legales, politicas y soporte.

### Como hacerlo

Crear una matriz de lanzamiento con estas columnas:

| Sede | Producto comercial | Producto operativo | Receta | Remision | Precio | Categoria | Imagen | Personalizaciones | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Ningun producto deberia pasar a activo en Pass si falta producto operativo, precio, sede o disponibilidad.

## 9. Verificacion antes de salir

- Producto operativo existe y esta activo.
- Producto operativo esta habilitado para la sede.
- Si es preparacion vendible, aparece en `pass.sell_products_by_site`.
- Receta existe si descuenta insumos.
- Remision existe si depende de otra sede.
- Producto comercial existe con precio por sede.
- Imagen y categoria estan completas.
- Personalizaciones renderizan y guardan.
- Checkout crea orden correcta.
- Pedido aparece en `Mis pedidos`.
- Inventario o consumo queda listo para aplicarse desde el flujo operativo definido.

## Preguntas que necesito cerrar contigo

1. Cuales sedes entran al lanzamiento de Pass.
2. Cuales productos exactos salen por sede.
3. Cuales productos se venden bajo pedido.
4. Cuales productos se producen localmente y cuales se remiten.
5. Cuales productos necesitan receta antes del lanzamiento.
6. Cuales personalizaciones son obligatorias para el primer release.
7. El MVP sale con pickup, delivery, pedidos programados o solo una modalidad.
8. Que pasarela o estado de pago se usara en lanzamiento.
9. Que productos deben tener tarjeta destacada o layout especial.
10. Quien aprueba precio final, imagen y disponibilidad por sede.

