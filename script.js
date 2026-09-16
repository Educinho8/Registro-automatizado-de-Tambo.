// Cambio desde rama develop
//Cambio desde rama feature

// --- INVENTARIO CONECTADO A BASE DE DATOS ---
const API_URL = "http://localhost:3000";

const users = [
    {
        email: "admin@tambo.pe",
        role: "admin",
        label: "Administrador"
    },
    {
        email: "empleado@tambo.pe",
        role: "employee",
        label: "Empleado"
    },
    {
        email: "almacen@tambo.pe",
        role: "employee",
        label: "Empleado"
    }
];

let inventory = [];
let movements = [];
let currentUser = JSON.parse(localStorage.getItem("tamboCurrentUser")) || null;

// --- SELECTORES DE ELEMENTOS ---
const loginPage = document.getElementById("loginPage");
const inventoryPage = document.getElementById("inventoryPage");
const loginForm = document.getElementById("loginForm");
const loginFeedback = document.getElementById("loginFeedback");
const tableBody = document.getElementById("inventoryTableBody");
const adminPanel = document.getElementById("adminPanel");
const addProductForm = document.getElementById("addProductForm");
const movementList = document.getElementById("movementList");
const currentUserLabel = document.getElementById("currentUserLabel");
const downloadReportBtn = document.getElementById("downloadReportBtn");

// --- CARGAR PRODUCTOS DESDE MYSQL ---
async function cargarProductos() {
    try {
        const respuesta = await fetch(`${API_URL}/productos`);
        const productos = await respuesta.json();

        inventory = productos.map(producto => {
            // Construir la URL completa de la imagen si proviene del backend
            let imgUrl = producto.imagen || "img/default_gaseosa.png";
            if (imgUrl && !imgUrl.startsWith("http") && !imgUrl.startsWith("/")) {
                imgUrl = `${API_URL}/${imgUrl}`;
            }

            return {
                id: producto.id_producto,
                name: producto.nombre,
                stock: producto.stock,
                image: imgUrl
            };
        });

        renderInventory();
    } catch (error) {
        alert("No se pudo conectar con la base de datos. Verifica que el backend esté encendido.");
        console.error(error);
    }
}

// --- EVENTO: LOGUEO ---
loginForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const user = document.getElementById("username").value.trim().toLowerCase();
    const pass = document.getElementById("password").value;

    const matchedUser = users.find(account => account.email === user);

    if (!matchedUser) {
        loginFeedback.style.color = "#ef4444";
        loginFeedback.innerHTML = "Usuario no registrado.";
        return;
    }

    if (!isValidPassword(pass)) {
        loginFeedback.style.color = "#ef4444";
        loginFeedback.innerHTML = "La contraseña debe tener 8 caracteres, mayúscula, minúscula, número y símbolo.";
        return;
    }

    currentUser = matchedUser;
    localStorage.setItem("tamboCurrentUser", JSON.stringify(currentUser));

    loginFeedback.style.color = "#10b981";
    loginFeedback.innerHTML = `Acceso concedido: ${matchedUser.label}`;

    setTimeout(() => {
        loginPage.classList.add("hidden");
        inventoryPage.classList.remove("hidden");
        applyRolePermissions();
        cargarProductos();
        cargarMovimientos();
    }, 700);
});

function isValidPassword(password) {
    const hasMinimumLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

    return hasMinimumLength && hasUppercase && hasLowercase && hasNumber && hasSpecialCharacter;
}

// --- AGREGAR PRODUCTO EN MYSQL ---
if (addProductForm) {
    addProductForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        if (!isAdmin()) {
            alert("Solo el administrador puede agregar productos.");
            return;
        }

        const nameInput = document.getElementById("productName");
        const stockInput = document.getElementById("productStock");
        const imageInput = document.getElementById("productImage");

        const name = nameInput.value.trim();
        const initialStock = parseInt(stockInput.value, 10);
        const image = imageInput.value.trim() || "img/default_gaseosa.png";

        if (!name) {
            alert("Ingrese el nombre de la gaseosa.");
            return;
        }

        if (Number.isNaN(initialStock) || initialStock < 0) {
            alert("Ingrese un stock inicial válido.");
            return;
        }

        try {
            const respuesta = await fetch(`${API_URL}/productos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: name,
                    marca: name,
                    presentacion: "Unidad",
                    stock: initialStock,
                    stock_minimo: 10,
                    imagen: image,
                    usuario: currentUser.email
                })
            });

            const data = await respuesta.json();

            if (!respuesta.ok) {
                alert(data.mensaje || "Error al agregar producto.");
                return;
            }

            addProductForm.reset();
            if (stockInput) stockInput.value = 0;
            cargarProductos();
            cargarMovimientos();
        } catch (error) {
            alert("No se pudo agregar el producto. Verifica que el backend esté encendido.");
            console.error(error);
        }
    });
}

// --- DESCARGAR REPORTE PDF Y LOGOUT ---
if (downloadReportBtn) {
    downloadReportBtn.addEventListener("click", function() {
        window.open(`${API_URL}/reportes/movimientos/pdf`, "_blank");
    });
}

function logout() {
    currentUser = null;
    localStorage.removeItem("tamboCurrentUser");
    inventoryPage.classList.add("hidden");
    loginPage.classList.remove("hidden");

    if (adminPanel) adminPanel.classList.add("hidden");

    document.getElementById("password").value = "";
    loginFeedback.innerHTML = "";
}

// --- PERMISOS POR ROL ---
function applyRolePermissions() {
    if (currentUserLabel) {
        currentUserLabel.textContent = currentUser ? currentUser.label : "Usuario";
    }

    if (!adminPanel) return;

    if (isAdmin()) {
        adminPanel.classList.remove("hidden");
    } else {
        adminPanel.classList.add("hidden");
    }
}

function isAdmin() {
    return currentUser && currentUser.role === "admin";
}

// --- RENDERIZAR TABLA DE INVENTARIO ---
function renderInventory() {
    tableBody.innerHTML = "";
    let lowStockAlerts = 0;

    inventory.forEach(item => {
        let badgeHTML = "";

        if (item.stock === 0) {
            badgeHTML = `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Agotado</span>`;
            lowStockAlerts++;
        } else if (item.stock < 10) {
            badgeHTML = `<span class="badge badge-critical"><i class="fa-solid fa-triangle-exclamation"></i> Stock Crítico</span>`;
            lowStockAlerts++;
        } else if (item.stock < 25) {
            badgeHTML = `<span class="badge badge-warning"><i class="fa-solid fa-clock"></i> Stock Bajo</span>`;
        } else {
            badgeHTML = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Abundante</span>`;
        }

        const deleteActions = `
            <button onclick="logicalDeleteProduct(${item.id})" class="btn-action-delete">
                <i class="fa-solid fa-eye-slash"></i> Ocultar
            </button>
            ${isAdmin() ? `
                <button onclick="physicalDeleteProduct(${item.id})" class="btn-action-delete">
                    <i class="fa-solid fa-trash-can"></i> Borrar BD
                </button>
            ` : ""}
        `;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                <div class="product-cell">
                    <span class="product-icon">
                        <img src="${item.image}" alt="${item.name}" class="product-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <span class="fallback-product-icon">🥤</span>
                    </span>
                    <span class="product-name">${item.name}</span>
                </div>
            </td>
            <td class="text-center stock-cell">
                ${item.stock} u.
            </td>
            <td>
                ${badgeHTML}
            </td>
            <td>
                <div class="actions-group">
                    <input
                        type="number"
                        id="qty-${item.id}"
                        class="qty-input"
                        min="1"
                        value="1"
                    >

                    <button onclick="adjustStockFromInput(${item.id}, 'add')" class="btn-action-add">
                        <i class="fa-solid fa-boxes-packing"></i> Recibir
                    </button>

                    <button onclick="adjustStockFromInput(${item.id}, 'remove')" class="btn-action-remove" ${item.stock === 0 ? "disabled" : ""}>
                        <i class="fa-solid fa-box-open"></i> Retirar
                    </button>

                    ${deleteActions}
                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });

    const lowStockElem = document.getElementById("lowStockCount");
    const totalProdElem = document.getElementById("totalProductsCount");
    if (lowStockElem) lowStockElem.textContent = lowStockAlerts;
    if (totalProdElem) totalProdElem.textContent = inventory.length;
}

// --- AJUSTAR STOCK VÍA API ---
async function adjustStockFromInput(productId, action) {
    const input = document.getElementById(`qty-${productId}`);
    const quantity = parseInt(input.value, 10);

    if (Number.isNaN(quantity) || quantity <= 0) {
        alert("Ingrese una cantidad válida mayor a 0.");
        return;
    }

    const endpoint = action === "add"
        ? `${API_URL}/productos/${productId}/aumentar`
        : `${API_URL}/productos/${productId}/disminuir`;

    try {
        const respuesta = await fetch(endpoint, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cantidad: quantity,
                usuario: currentUser.email
            })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            alert(data.mensaje || "No se pudo actualizar el stock.");
            return;
        }

        cargarProductos();
        cargarMovimientos();
    } catch (error) {
        alert("Error de conexión al actualizar el stock.");
        console.error(error);
    }
}

// --- ELIMINAR PRODUCTOS VÍA API ---
async function logicalDeleteProduct(productId) {
    const confirmed = confirm("¿Deseas ocultar este producto del inventario?");
    if (!confirmed) return;

    try {
        const respuesta = await fetch(`${API_URL}/productos/${productId}/eliminar-logico`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: currentUser.email })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            alert(data.mensaje || "No se pudo eliminar el producto.");
            return;
        }

        cargarProductos();
        cargarMovimientos();
    } catch (error) {
        alert("Error al intentar ocultar el producto.");
        console.error(error);
    }
}

async function physicalDeleteProduct(productId) {
    if (!isAdmin()) {
        alert("Solo el administrador puede eliminar físicamente productos.");
        return;
    }

    const confirmed = confirm("¿Deseas borrar este producto definitivamente de la base de datos?");
    if (!confirmed) return;

    try {
        const respuesta = await fetch(`${API_URL}/productos/${productId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: currentUser.email })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) {
            alert(data.mensaje || "No se pudo eliminar físicamente el producto.");
            return;
        }

        cargarProductos();
        cargarMovimientos();
    } catch (error) {
        alert("Error al intentar borrar el producto de la base de datos.");
        console.error(error);
    }
}

// --- BITÁCORA DE MOVIMIENTOS ---
async function cargarMovimientos() {
    if (!movementList || !isAdmin()) return;

    try {
        const respuesta = await fetch(`${API_URL}/movimientos`);
        const data = await respuesta.json();

        if (!respuesta.ok) {
            return;
        }

        movements = data.map(movement => ({
            product: movement.nombre_producto,
            type: movement.tipo_movimiento,
            quantity: movement.cantidad,
            stockBefore: movement.stock_anterior,
            stockAfter: movement.stock_nuevo,
            user: `${movement.usuario} (${movement.rol})`,
            date: new Date(movement.fecha_movimiento).toLocaleString("es-PE")
        }));

        renderMovements();
    } catch (error) {
        console.error("Error al cargar movimientos:", error);
    }
}

function renderMovements() {
    if (!movementList) return;

    if (!isAdmin()) {
        movementList.innerHTML = "";
        return;
    }

    if (movements.length === 0) {
        movementList.innerHTML = `<p class="empty-state">Todavía no hay movimientos registrados.</p>`;
        return;
    }

    movementList.innerHTML = movements.map(movement => `
        <article class="movement-item">
            <div>
                <strong>${movement.type}</strong>
                <span>${movement.product}</span>
            </div>
            <div class="movement-meta">
                <span>${movement.quantity} u.</span>
                <span>Antes: ${movement.stockBefore ?? "-"}</span>
                <span>Stock: ${movement.stockAfter}</span>
                <span>${movement.user}</span>
                <span>${movement.date}</span>
            </div>
        </article>
    `).join("");
}

// --- INICIALIZACIÓN ---
window.addEventListener("DOMContentLoaded", function() {
    if (currentUser) {
        loginPage.classList.add("hidden");
        inventoryPage.classList.remove("hidden");
        applyRolePermissions();
        cargarProductos();
        cargarMovimientos();
    }
});