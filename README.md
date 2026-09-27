# Inventario de productos cosméticos

Sistema web para gestionar catálogo, entradas (compras), salidas (ventas/muestras/daños), clientes, proveedores, alertas de caducidad, stock crítico y reportes PDF.

## Requisitos y versiones

| Software | Versión recomendada |
|---|---|
| Node.js | 18 o superior (probado con 18+) |
| npm | 9 o superior (incluido con Node) |
| MySQL | 8.0 o superior |
| Navegador | Chrome, Edge o Firefox actualizado |

No se requiere un framework de frontend adicional: la interfaz está en `public/` (HTML, CSS y JavaScript).

## Cómo ejecutarlo

1. Instalar Node.js y MySQL 8.
2. Crear la base de datos e importar el script:

```sql
SOURCE database/inventario_cosmeticos.sql;
```

En MySQL Workbench: **File → Run SQL Script** y seleccionar `database/inventario_cosmeticos.sql`.

En consola:

```bash
mysql -u root -p < database/inventario_cosmeticos.sql
```

3. En la carpeta del proyecto, copiar las variables de entorno:

```bash
copy .env.example .env
```

En macOS/Linux: `cp .env.example .env`

4. Editar `.env` con los datos de tu MySQL:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password_de_mysql
DB_NAME=inventario_cosmeticos
DB_PORT=3306
PORT=3000
JWT_SECRET=cambia_esta_clave_por_una_larga_y_secreta
```

5. Instalar dependencias e iniciar:

```bash
npm install
npm start
```

6. Abrir en el navegador: [http://localhost:3000](http://localhost:3000)

## Usuarios de prueba

Contraseña de todos: `Prueba123`

| Rol | Correo | Contraseña | Qué esperar |
|---|---|---|---|
| Administrador | `admin@correo.com` | `Prueba123` | Acceso total al sistema, gestión de usuarios/vendedores y restablecimiento de claves |
| Vendedor | `vendedor@correo.com` | `Prueba123` | Acceso a operaciones (ventas con carrito, compras, alertas, clientes, reportes; pestaña Vendedores oculta) |
| Inactivo (control negativo) | `inactivo@correo.com` | `Prueba123` | Debe rechazar el login: cuenta inactiva |

La sesión dura 8 horas (JWT).

## Datos de prueba incluidos

- Categorías: Skincare, Maquillaje, Cabello, Perfumería.

### Fechas de vencimiento por categoría

Las categorías actuales requieren fecha de vencimiento. Al crear una categoría nueva,
se puede desmarcar **Esta categoría requiere fecha de vencimiento** para artículos
duraderos, por ejemplo una categoría **Herramientas para cabello** para planchas y
secadores. Así, los productos cosméticos de la categoría **Cabello** conservan su
control de vencimiento.

En una base de datos existente, ejecutar una sola vez
`database/migracion_vencimiento_por_categoria.sql` antes de desplegar la actualización.
La base que se crea desde cero con `database/inventario_cosmeticos.sql` ya incluye
estos cambios.
- Productos con precio de venta mayor al costo de compra (hay margen).
- Lotes para validar caducidad:
  - un lote **vencido** (crema de arroz)
  - un lote **urgente** (rímel, vence en ~12 días)
  - lotes vigentes a mediano/largo plazo
- **Stock crítico:** rímel (`MAQ-002`) tiene stock actual 8 y mínimo 15.
- Clientes, proveedores, entradas y salidas para el reporte de movimientos.

## Documentación para pruebas

Ver `DOCUMENTACION.md`: funcionalidades, reglas de negocio y casos sugeridos de validación.
