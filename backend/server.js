const express = require("express");
const cors = require("cors");
const path = require("path");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/img", express.static(path.join(__dirname, "../img")));

// --- Funciones Auxiliares (Base de Datos) ---

async function obtenerUsuarioId(correo) {
  const sql = `
    SELECT id_usuario
    FROM usuarios
    WHERE correo = ? AND estado = 'activo'
    LIMIT 1
  `;
  const [results] = await db.query(sql, [correo]);
  return results.length > 0 ? results[0].id_usuario : null;
}

async function registrarMovimiento(datos) {
  const idUsuario = await obtenerUsuarioId(datos.usuario);
  if (!idUsuario) {
    throw new Error("Usuario no encontrado para registrar movimiento");
  }

  const sql = `
    INSERT INTO movimientos
    (id_producto, id_usuario, nombre_producto, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, descripcion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  return db.query(sql, [
    datos.idProducto,
    idUsuario,
    datos.nombreProducto,
    datos.tipo,
    datos.cantidad,
    datos.stockAnterior,
    datos.stockNuevo,
    datos.descripcion
  ]);
}

async function obtenerProductoActivo(id) {
  const sql = `
    SELECT *
    FROM productos
    WHERE id_producto = ? AND estado = 'activo'
    LIMIT 1
  `;
  const [results] = await db.query(sql, [id]);
  return results[0] || null;
}

// --- Endpoints / Rutas ---

// Mostrar productos activos (con buscador)
app.get("/productos", async (req, res) => {
  try {
    const buscar = req.query.buscar || "";
    const sql = `
      SELECT *
      FROM productos
      WHERE estado = 'activo'
      AND (nombre LIKE ? OR marca LIKE ?)
    `;
    const filtro = `%${buscar}%`;
    const [results] = await db.query(sql, [filtro, filtro]);
    res.json(results);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener productos", error: error.message });
  }
});

// Agregar producto
app.post("/productos", async (req, res) => {
  try {
    const { nombre, marca, presentacion, stock, stock_minimo, imagen, usuario } = req.body;

    const sql = `
      INSERT INTO productos
      (nombre, categoria, marca, presentacion, stock, stock_minimo, imagen)
      VALUES (?, 'Gaseosa', ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [nombre, marca, presentacion, stock, stock_minimo, imagen]);

    await registrarMovimiento({
      idProducto: result.insertId,
      nombreProducto: nombre,
      usuario,
      tipo: "creacion",
      cantidad: stock,
      stockAnterior: 0,
      stockNuevo: stock,
      descripcion: "Producto creado desde el panel administrador"
    });

    res.json({
      mensaje: "Producto agregado correctamente",
      id_producto: result.insertId
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al agregar producto", error: error.message });
  }
});

// Aumentar stock
app.put("/productos/:id/aumentar", async (req, res) => {
  try {
    const { cantidad, usuario } = req.body;
    const { id } = req.params;

    const producto = await obtenerProductoActivo(id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const stockNuevo = producto.stock + cantidad;
    const sql = `
      UPDATE productos
      SET stock = ?
      WHERE id_producto = ? AND estado = 'activo'
    `;

    await db.query(sql, [stockNuevo, id]);

    await registrarMovimiento({
      idProducto: producto.id_producto,
      nombreProducto: producto.nombre,
      usuario,
      tipo: "entrada",
      cantidad,
      stockAnterior: producto.stock,
      stockNuevo,
      descripcion: "Ingreso de unidades desde la web"
    });

    res.json({ mensaje: "Stock aumentado correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al aumentar stock", error: error.message });
  }
});

// Disminuir stock
app.put("/productos/:id/disminuir", async (req, res) => {
  try {
    const { cantidad, usuario } = req.body;
    const { id } = req.params;

    const producto = await obtenerProductoActivo(id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    if (producto.stock < cantidad) {
      return res.status(400).json({ mensaje: "Stock insuficiente" });
    }

    const stockNuevo = producto.stock - cantidad;
    const sql = `
      UPDATE productos
      SET stock = ?
      WHERE id_producto = ? AND estado = 'activo'
    `;

    await db.query(sql, [stockNuevo, id]);

    await registrarMovimiento({
      idProducto: producto.id_producto,
      nombreProducto: producto.nombre,
      usuario,
      tipo: "salida",
      cantidad,
      stockAnterior: producto.stock,
      stockNuevo,
      descripcion: "Retiro de unidades desde la web"
    });

    res.json({ mensaje: "Stock disminuido correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al disminuir stock", error: error.message });
  }
});

// Eliminación lógica
app.put("/productos/:id/eliminar-logico", async (req, res) => {
  try {
    const { usuario } = req.body;
    const { id } = req.params;

    const producto = await obtenerProductoActivo(id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const sql = `
      UPDATE productos
      SET estado = 'inactivo'
      WHERE id_producto = ?
    `;

    await db.query(sql, [id]);

    await registrarMovimiento({
      idProducto: producto.id_producto,
      nombreProducto: producto.nombre,
      usuario,
      tipo: "eliminacion_logica",
      cantidad: 0,
      stockAnterior: producto.stock,
      stockNuevo: producto.stock,
      descripcion: "Producto ocultado desde la web"
    });

    res.json({ mensaje: "Producto ocultado correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al ocultar producto", error: error.message });
  }
});

// Eliminación física
app.delete("/productos/:id", async (req, res) => {
  try {
    const { usuario } = req.body;
    const { id } = req.params;

    const sqlProducto = `
      SELECT * FROM productos WHERE id_producto = ? LIMIT 1
    `;
    const [results] = await db.query(sqlProducto, [id]);

    if (results.length === 0) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const producto = results[0];

    await registrarMovimiento({
      idProducto: producto.id_producto,
      nombreProducto: producto.nombre,
      usuario,
      tipo: "eliminacion_fisica",
      cantidad: 0,
      stockAnterior: producto.stock,
      stockNuevo: 0,
      descripcion: "Producto eliminado definitivamente de la base de datos"
    });

    const sqlDelete = `DELETE FROM productos WHERE id_producto = ?`;
    await db.query(sqlDelete, [id]);

    res.json({ mensaje: "Producto eliminado físicamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar físicamente", error: error.message });
  }
});

// Consultar movimientos
app.get("/movimientos", async (req, res) => {
  try {
    const sql = `
      SELECT
        m.id_movimiento,
        m.nombre_producto,
        m.tipo_movimiento,
        m.cantidad,
        m.stock_anterior,
        m.stock_nuevo,
        m.descripcion,
        m.fecha_movimiento,
        u.nombre AS usuario,
        u.rol
      FROM movimientos m
      INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
      ORDER BY m.fecha_movimiento DESC
      LIMIT 50
    `;
    const [results] = await db.query(sql);
    res.json(results);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener movimientos", error: error.message });
  }
});

// Reporte de movimientos en PDF
app.get("/reportes/movimientos/pdf", async (req, res) => {
  try {
    const sql = `
      SELECT
        m.nombre_producto,
        m.tipo_movimiento,
        m.cantidad,
        m.stock_anterior,
        m.stock_nuevo,
        m.descripcion,
        DATE_FORMAT(m.fecha_movimiento, '%d/%m/%Y %H:%i:%s') AS fecha,
        u.nombre AS usuario,
        u.rol
      FROM movimientos m
      INNER JOIN usuarios u ON u.id_usuario = m.id_usuario
      ORDER BY m.fecha_movimiento DESC
    `;

    const [movimientos] = await db.query(sql);
    const doc = new PDFDocument({ margin: 42, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=reporte-movimientos-tambo.pdf");

    doc.pipe(res);
    doc.fontSize(20).fillColor("#662d91").text("Tambo+ Reporte de Movimientos", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#333").text(`Generado: ${new Date().toLocaleString("es-PE")}`, { align: "center" });
    doc.moveDown();
    doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor("#ffcc00").lineWidth(2).stroke();
    doc.moveDown();

    if (movimientos.length === 0) {
      doc.fontSize(12).fillColor("#333").text("No hay movimientos registrados.");
    }

    movimientos.forEach((movimiento, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.roundedRect(42, doc.y, 511, 88, 6).strokeColor("#e5e7eb").lineWidth(1).stroke();
      doc.moveDown(0.4);
      doc.fontSize(12).fillColor("#111827").text(`${index + 1}. ${movimiento.nombre_producto}`, 56, doc.y);
      doc.fontSize(9).fillColor("#662d91").text(`Movimiento: ${movimiento.tipo_movimiento}`, 56);
      doc.fillColor("#333").text(`Cantidad: ${movimiento.cantidad} | Stock anterior: ${movimiento.stock_anterior} | Stock nuevo: ${movimiento.stock_nuevo}`, 56);
      doc.text(`Usuario: ${movimiento.usuario} (${movimiento.rol})`, 56);
      doc.text(`Fecha: ${movimiento.fecha}`, 56);
      doc.fillColor("#6b7280").text(`Detalle: ${movimiento.descripcion || "Sin detalle"}`, 56);
      doc.moveDown(1.4);
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ mensaje: "Error al generar reporte PDF", error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(` Servidor corriendo en http://localhost:${PORT}`);
});