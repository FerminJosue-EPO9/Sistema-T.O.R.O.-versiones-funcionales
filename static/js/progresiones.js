// ==========================================
// CONTEXTO Y VARIABLES GLOBALES
// ==========================================
let contexto = null;
let editarProgresionIndex = null;
let eliminarProgresionIndex = null;

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const raw = localStorage.getItem("progresionContexto");
    if (!raw) {
        window.location.href = "/grupos";
        return;
    }
    contexto = JSON.parse(raw);
    actualizarBreadcrumb();
    cargarProgresiones();
});

function actualizarBreadcrumb() {
    const breadcrumb = document.getElementById("breadcrumbTexto");
    if (!breadcrumb || !contexto) return;

    const { grupo, materia, parcial } = contexto;

    fetch(`/api/obtener_progresiones?grupo=${grupo}&materia=${materia}&parcial=${parcial}`)
        .then(() => fetch("/api/grupos"))
        .then(r => r.json())
        .then(grupos => {

            const nombreGrupo =
                grupos[grupo]?.nombre || `Grupo ${grupo + 1}`;

            const nombreMateria =
                grupos[grupo]?.materias?.[materia]?.nombre || "Materia";

            const nombreParcial =
                grupos[grupo]?.materias?.[materia]?.parciales?.[parcial]?.nombre || "Parcial";

            breadcrumb.innerHTML = `
                Grupos > ${nombreGrupo} > ${nombreMateria} > ${nombreParcial}
            `;
        })
        .catch(() => {
            breadcrumb.textContent = "Grupos > Progresiones";
        });
}

// ==========================================
// CARGAR PROGRESIONES DESDE EL BACKEND
// ==========================================
function cargarProgresiones() {
    const { grupo, materia, parcial } = contexto;
    fetch(`/api/obtener_progresiones?grupo=${grupo}&materia=${materia}&parcial=${parcial}`)
        .then(response => response.json())
        .then(progresiones => {
            if (!progresiones || progresiones.length === 0) {
                mostrarSeccionVacia();
            } else {
                mostrarSeccionConProgresiones(progresiones);
            }
        })
        .catch(error => {
            console.error("Error cargando progresiones:", error);
            mostrarSeccionVacia();
        });
}

function mostrarSeccionVacia() {
    document.getElementById("seccionVacia").classList.add("activa");
    document.getElementById("seccionProgresiones").classList.remove("activa");
}

function mostrarSeccionConProgresiones(progresiones) {
    const contenedor = document.getElementById("listaProgresiones");
    contenedor.innerHTML = "";
    progresiones.forEach((prog, idx) => {
        const card = document.createElement("div");
        card.classList.add("progresion-card");
        card.innerHTML = `
            <div class="progresion-contenido">
                <div class="info-progresion">
                    <span class="progresion-numero">Progresión ${idx+1}</span>
                    <span class="progresion-tema">${escapeHtml(prog)}</span>
                </div>
                <div class="acciones-progresion">
                    <button class="btn-editar-prog" onclick="editarProgresion(${idx})" title="Editar">
                        <img src="/static/img/editar2.png" alt="Editar">
                    </button>
                    <button class="btn-eliminar-prog" onclick="eliminarProgresion(${idx})" title="Eliminar">
                        <img src="/static/img/eliminar2.png" alt="Eliminar">
                    </button>
                </div>
            </div>
        `;
        contenedor.appendChild(card);
    });
    document.getElementById("seccionVacia").classList.remove("activa");
    document.getElementById("seccionProgresiones").classList.add("activa");
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==========================================
// MODAL CREAR PROGRESIÓN
// ==========================================
function abrirModalProgresion() {
    document.getElementById("inputNombreProgresion").value = "";
    const modal = document.getElementById("modalCrearProgresion");
    modal.classList.add("activa");
    setTimeout(() => document.getElementById("inputNombreProgresion").focus(), 100);
}

function cerrarModalProgresion() {
    const modal = document.getElementById("modalCrearProgresion");
    modal.classList.remove("activa");
}

function confirmarCrearProgresion() {
    const nombre = document.getElementById("inputNombreProgresion").value.trim();
    if (!nombre) return;
    const { grupo, materia, parcial } = contexto;
    fetch("/api/crear_progresion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo, materia, parcial, nombre })
    })
    .then(r => r.json())
    .then(data => {
        if (data.exito) {
            cerrarModalProgresion();
            cargarProgresiones();
        } else {
            alert("Error: " + (data.mensaje || "No se pudo crear la progresión."));
        }
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Error de conexión con el servidor.");
    });
}

// ==========================================
// MODAL EDITAR PROGRESIÓN
// ==========================================
function editarProgresion(index) {
    const { grupo, materia, parcial } = contexto;

    fetch(`/api/obtener_progresiones?grupo=${grupo}&materia=${materia}&parcial=${parcial}`)
        .then(r => r.json())
        .then(progresiones => {
            if (!Array.isArray(progresiones)) {
                mostrarModalInfoProg("Error", "No se pudieron cargar las progresiones.");
                return;
            }

            if (index < 0 || index >= progresiones.length) {
                mostrarModalInfoProg("Error", "Progresión no válida.");
                return;
            }

            editarProgresionIndex = index;

            const input = document.getElementById("inputEditarProgresion");
            input.value = progresiones[index];

            const modal = document.getElementById("modalEditarProgresion");
            modal.classList.add("activa");

            setTimeout(() => input.focus(), 100);
        })
        .catch(error => {
            console.error("Error:", error);
            mostrarModalInfoProg("Error", "Error de conexión con el servidor.");
        });
}

function cerrarModalEditarProgresion() {
    const modal = document.getElementById("modalEditarProgresion");
    modal.classList.remove("activa");
    editarProgresionIndex = null;
}

function confirmarEditarProgresion() {
    const nuevoNombre = document.getElementById("inputEditarProgresion").value.trim();

    if (!nuevoNombre) {
        mostrarModalInfoProg("Aviso", "El nombre de la progresión no puede estar vacío.");
        return;
    }

    if (editarProgresionIndex === null) return;

    const { grupo, materia, parcial } = contexto;

    fetch("/api/editar_progresion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grupo: grupo,
            materia: materia,
            parcial: parcial,
            progresion: editarProgresionIndex,
            nombre: nuevoNombre
        })
    })
    .then(r => r.json())
    .then(data => {
        cerrarModalEditarProgresion();

        if (data.exito) {
            cargarProgresiones();
        } else {
            mostrarModalInfoProg("Error", data.mensaje || "No se pudo editar la progresión.");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        cerrarModalEditarProgresion();
        mostrarModalInfoProg("Error", "Error de conexión con el servidor.");
    });
}

// ==========================================
// MODAL ELIMINAR PROGRESIÓN
// ==========================================
function eliminarProgresion(index) {
    eliminarProgresionIndex = index;
    const modal = document.getElementById("modalEliminarProgresion");
    modal.classList.add("activa");
}

function cerrarModalEliminarProgresion() {
    const modal = document.getElementById("modalEliminarProgresion");
    modal.classList.remove("activa");
    eliminarProgresionIndex = null;
}

// ==========================================
// MODAL ELIMINAR PROGRESIÓN
// ==========================================
function ejecutarEliminarProgresion() {
    if (eliminarProgresionIndex === null) return;
    const { grupo, materia, parcial } = contexto;
    fetch("/api/eliminar_elemento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grupo: grupo,
            materia: materia,
            parcial: parcial,
            progresion: eliminarProgresionIndex
        })
    })
    .then(r => r.json())
    .then(data => {
        // 1. Cerramos el modal de confirmación
        cerrarModalEliminarProgresion(); 
        
        if (data.exito) {
            // 2. Verificamos si se eliminaron lecciones en cascada
            if (data.lecciones_eliminadas && data.lecciones_eliminadas > 0) {
                mostrarModalInfoProg("Lecciones eliminadas", `Se han eliminado ${data.lecciones_eliminadas} lección(es) que dependían de esta progresión.`);
            }
            // 3. Recargamos la vista
            cargarProgresiones();
        } else {
            mostrarModalInfoProg("Error", data.mensaje || "No se pudo eliminar la progresión.");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        cerrarModalEliminarProgresion();
        mostrarModalInfoProg("Error", "Error de conexión con el servidor.");
    });
}

// ==========================================
// MODAL DE INFORMACIÓN (NUEVO)
// ==========================================
function mostrarModalInfoProg(titulo, mensaje) {
    // Si tienes un modalInfo global en layout.html, puedes usar ese. 
    // De lo contrario, usamos este local.
    const modal = document.getElementById("modalInfoProg");
    if (modal) {
        document.getElementById("tituloModalInfoProg").textContent = titulo;
        document.getElementById("textoModalInfoProg").textContent = mensaje;
        modal.classList.add("activa");
    } else {
        // Fallback por si no se ha agregado el HTML
        alert(`${titulo}\n${mensaje}`);
    }
}

function cerrarModalInfoProg() {
    const modal = document.getElementById("modalInfoProg");
    if (modal) modal.classList.remove("activa");
}