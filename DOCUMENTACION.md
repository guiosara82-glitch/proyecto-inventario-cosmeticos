# Documentación del Sistema de Gestión de Inventario Cosmético

Sistema web de gestión de inventario y punto de venta para productos cosméticos. Funciona bajo una arquitectura SPA (Single Page Application) donde, tras autenticarse, el usuario interactúa mediante pestañas y ventanas modales de respuesta rápida.

---

## 1. Alcance Funcional

El sistema cubre los siguientes procesos operativos:

1. **Autenticación y Seguridad:** Inicio de sesión con JWT, protección contra ataques de fuerza bruta, cierre de sesión con revocación de token, visualización de contraseña y recuperación.
2. **Control de Acceso Basado en Roles (RBAC):** Permisos diferenciados entre Administrador y Vendedor.
3. **Gestión de Productos y Catálogo:** Catálogo completo, validación de SKU con formato formal, rangos de precio con margen de ganancia obligatorio sobre costo de lotes y registro modal de nuevas categorías.
4. **Entradas de Inventario (Compras):** Registro de compras por lote con costo, fecha de vencimiento y cálculo de margen proyectado. Inclusión de modal para alta rápida de proveedores.
5. **Salidas de Inventario (Ventas):** Facturación con carrito multi-producto, deducción automática FIFO por lotes vigentes, validación de margen de ganancia comercial y exclusión de lotes caducados o productos inactivos.
6. **Gestión de Clientes:** Registro con validación estricta de documento y contacto (teléfono o correo), listado y actualización de información mediante ventana modal.
7. **Proveedores:** Directorio y registro independiente o desde el módulo de compras.
8. **Alertas de Caducidad:** Monitor de productos próximos a vencer (≤ 30 días) y productos ya vencidos con tiempo transcurrido en texto claro.
9. **Stock Crítico:** Detección automática de existencias iguales o inferiores al stock mínimo.
10. **Gestión de Usuarios / Vendedores:** Creación de usuarios con roles y contraseñas seguras, visualización de estado y restablecimiento de credenciales por parte del Administrador.
11. **Reportes y Exportación PDF:** Generación en pantalla y exportación de reportes de caducidad y movimientos con filtros de fechas.

---

## 2. Roles y Control de Acceso (RBAC)

Existen dos roles configurados en la base de datos:

| Rol | Alcance y Permisos |
|---|---|
| **Administrador** | Acceso total a todos los módulos: Productos, Entradas, Salidas, Clientes, Proveedores, Alertas, Stock Crítico, **Vendedores** (creación de usuarios y restablecimiento de contraseñas) y Reportes. |
| **Vendedor** | Acceso a operaciones diarias: Productos, Entradas, Salidas, Clientes, Proveedores, Alertas, Stock Crítico y Reportes. **La pestaña Vendedores se encuentra oculta y protegida en la API (HTTP 403 Forbidden)** para evitar escalada de privilegios. |

- Los usuarios en estado `INACTIVO` tienen el acceso denegado inmediatamente al intentar iniciar sesión.
- En compras y ventas, el responsable queda registrado de forma automática según la sesión activa verificada por el token JWT, garantizando la trazabilidad.

---

## 3. Reglas de Negocio por Módulo

### 3.1. Inicio de Sesión y Seguridad
- **Mensaje Genérico:** Si el correo no existe o la contraseña es incorrecta, el sistema responde *"Correo o contraseña incorrectos."*, impidiendo la enumeración de correos.
- **Protección Fuerza Bruta:** Tras 5 intentos fallidos consecutivos sobre una cuenta, el acceso se bloquea temporalmente por 15 minutos (código 429).
- **Revocación de Token (Logout):** Al cerrar sesión, el token JWT se invalida en el servidor; peticiones posteriores con dicho token son rechazadas con código 401.
- **Mostrar/Ocultar Clave:** Botón con ícono de ojo para verificar la contraseña antes de enviar.
- **Recuperación:** Opción *"¿Olvidaste tu contraseña?"* que canaliza la solicitud con los administradores para restablecer el acceso desde el panel de vendedores.

### 3.2. Catálogo y Productos
- **SKU Único con Formato:** Debe cumplir con el estándar de código (ej. `MAQ-001`, `SKI-002`, entre 2 y 8 letras, guion y números).
- **Nombre y Marca:** Deben contener caracteres alfabéticos válidos (no se admiten valores solo numéricos o símbolos como "-1").
- **Rango de Precio:** Precio mínimo comercial de **$100.00** y máximo de **$99,999,999.99**.
- **Control de Margen al Editar:** Si un producto tiene lotes con stock disponible, el precio de venta no puede ser menor o igual al costo de adquisición de dichos lotes.
- **Categoría Rápida:** Botón `+ Nueva` que abre un modal para ingresar la categoría y la auto-selecciona sin abandonar el formulario de producto.

### 3.3. Entradas (Compras)
- **Campos Obligatorios:** Proveedor, producto, cantidad (> 0), costo unitario (> 0) y fecha de vencimiento posterior al día actual.
- **Regla de Rentabilidad:** El costo de compra debe ser estrictamente menor al precio de venta del catálogo para asegurar margen de ganancia.
- **Proveedor Rápido:** Botón `+ Nuevo` con modal para dar de alta un proveedor y asignarlo de inmediato.
- **Filtro de Inactivos:** Solo se permite registrar entradas sobre productos activos.

### 3.4. Salidas (Ventas)
- **Carrito Multi-Producto:** Se pueden agregar múltiples productos a una misma venta antes de confirmarla, visualizando cantidad, concepto, subtotales y total general.
- **Conceptos:** `VENTA`, `MUESTRA` o `DAÑADO`.
- **Exclusión de Lotes Vencidos:** El sistema ignora lotes cuya fecha de vencimiento sea anterior a la fecha actual (`fecha_vencimiento < CURDATE()`), bloqueando la venta de producto vencido.
- **Deducción FIFO:** Se consumen primero los lotes vigentes con fecha de vencimiento más próxima.
- **Validación de Ganancia:** En salidas por venta, el precio de salida debe superar el costo del lote que se descuenta.
- **Productos Inactivos:** No aparecen en los selectores ni pueden ser comercializados.

### 3.5. Clientes
- **Documento:** Numérico, entre 8 y 10 dígitos (cédula o NIT).
- **Nombre:** Solo letras y espacios (mínimo 2 caracteres).
- **Contacto:** Teléfono de 7 a 10 dígitos o correo electrónico válido.
- **Edición:** Botón `✏️ Editar` en la tabla para actualizar nombre y contacto mediante ventana modal.

### 3.6. Alertas y Reportes
- **Visualización de Caducidad:** Para lotes con fecha vencida, se muestra con claridad *"Vencido hace X día(s)"* en lugar de números negativos.
- **Estados:** `VENCIDO`, `URGENTE` (≤ 30 días restantes) o `PROXIMO`.
- **Exportación PDF:** Reporte de caducidad y de movimientos entre fechas con formato imprimible oficial.

---

## 4. Guía de Ejecución y Pruebas

### Iniciar el Sistema
```bash
# Instalar dependencias (si es primera vez)
npm install

# Iniciar servidor Node.js
npm start
```
Abrir el navegador en `http://localhost:3000`.

### Cuentas Preconfiguradas para Pruebas
| Correo | Contraseña | Rol | Estado |
|---|---|---|---|
| `admin@correo.com` | `Prueba123` | Administrador | ACTIVO |
| `vendedor@correo.com` | `Prueba123` | Vendedor | ACTIVO |
| `inactivo@correo.com` | `Prueba123` | Vendedor | INACTIVO |
