// ==========================================
// FUNCIONES DEL MODAL
// ==========================================
function abrirModal() {
    const modal = document.getElementById("modalNuevoGrupo");
    if (modal) modal.classList.add("activa");
}

function cerrarModal() {
    const modal = document.getElementById("modalNuevoGrupo");
    if (modal) modal.classList.remove("activa");
    document.getElementById("nombreGrupo").value = "";
    document.getElementById("archivoAlumnos").value = "";
    archivoValidado = false;
    datosAlumnos = null;
    mostrarMensaje("", "");
}

// ==========================================
// GUARDAR GRUPO (con validación local)
// ==========================================
let archivoValidado = false;
let datosAlumnos = null;

document.getElementById("archivoAlumnos").addEventListener("change", validarArchivo);

function validarArchivo(event) {
    const archivo = event.target.files[0];
    if (!archivo) {
        archivoValidado = false;
        datosAlumnos = null;
        mostrarMensaje("", "");
        return;
    }

    const lector = new FileReader();
    lector.onload = function(e) {
        const contenido = e.target.result.replace(/\r/g, "").trim();
        if (!contenido) {
            mostrarMensaje("El archivo está vacío. Debe contener al menos una línea con el formato: Matrícula|Nombre|Apellidos", "error");
            archivoValidado = false;
            datosAlumnos = null;
            return;
        }

        const lineas = contenido.split("\n").filter(linea => linea.trim() !== "");
        const alumnosTemp = [];
        for (let i = 0; i < lineas.length; i++) {
            const partes = lineas[i].split("|");
            if (partes.length !== 3) {
                mostrarMensaje(`Error en línea ${i+1}: Debe tener exactamente 3 campos separados por '|' (Matrícula|Nombre|Apellidos).`, "error");
                archivoValidado = false;
                datosAlumnos = null;
                return;
            }
            const matricula = partes[0].trim();
            const nombres = partes[1].trim();
            const apellidos = partes[2].trim();
            if (!matricula || !nombres || !apellidos) {
                mostrarMensaje(`Error en línea ${i+1}: Ningún campo puede estar vacío.`, "error");
                archivoValidado = false;
                datosAlumnos = null;
                return;
            }
            alumnosTemp.push({ matricula, nombres, apellidos });
        }
        mostrarMensaje(`Archivo válido. Se cargaron ${alumnosTemp.length} alumnos.`, "exito");
        archivoValidado = true;
        datosAlumnos = alumnosTemp;
    };
    lector.readAsText(archivo, "UTF-8");
}

function mostrarMensaje(texto, tipo) {
    const mensajeDiv = document.getElementById("mensajeModal");
    if (!texto) {
        mensajeDiv.style.display = "none";
        mensajeDiv.innerHTML = "";
        return;
    }
    mensajeDiv.innerHTML = texto;
    mensajeDiv.className = "mensaje-modal " + tipo;
    mensajeDiv.style.display = "block";
}

function guardarGrupo() {
    const nombre = document.getElementById("nombreGrupo").value.trim();
    const archivoInput = document.getElementById("archivoAlumnos");

    if (!nombre) {
        mostrarMensaje("El nombre del grupo es obligatorio.", "error");
        return;
    }
    if (!archivoInput.files.length) {
        mostrarMensaje("Selecciona un archivo .txt con la lista de alumnos.", "error");
        return;
    }
    if (!archivoValidado || !datosAlumnos) {
        mostrarMensaje("El archivo no es válido. Verifica el formato e inténtalo de nuevo.", "error");
        return;
    }

    const formData = new FormData();
    formData.append("nombre", nombre);
    formData.append("archivo", archivoInput.files[0]);

    fetch("/crear_grupo", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.exito) {
            mostrarMensaje("Grupo creado exitosamente.", "exito");
            setTimeout(() => {
                cerrarModal();
                cargarYElegirSeccion();
            }, 1500);
        } else {
            mostrarMensaje("Error: " + (data.mensaje || "No se pudo crear el grupo."), "error");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        mostrarMensaje("Error de conexión con el servidor.", "error");
    });
}

// ==========================================
// RENDERIZAR GRUPOS (estructura completa)
// ==========================================
function renderizarGrupos(grupos) {
    const contenedor = document.getElementById("listaGrupos");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    if (!grupos || grupos.length === 0) return;

    grupos.forEach((grupo, idxGrupo) => {
        const tarjeta = document.createElement("div");
        tarjeta.classList.add("grupo-card");
        tarjeta.innerHTML = `
            <div class="grupo-header">
                <span class="nombreGrupo">Grupo ${grupo.nombre}</span>
                <button class="btn-cerrar-rojo" onclick="eliminarGrupo(${idxGrupo})" title="Eliminar Grupo">
                    <img src="/static/img/eliminar.svg" alt="Eliminar" style="width: 20px; height: 20px;">
                </button>
            </div>
            <div class="grupo-body" id="materias-${idxGrupo}"></div>
        `;
        contenedor.appendChild(tarjeta);
        renderizarMaterias(grupo.materias, idxGrupo);
    });
}

function renderizarMaterias(materias, idxGrupo) {
    const container = document.getElementById(`materias-${idxGrupo}`);
    if (!container) return;
    container.innerHTML = "";
    if (!materias || materias.length === 0) {
        container.innerHTML = `<div class="mensaje-vacio">Aún no hay materias. <button class="btn-materia" onclick="agregarMateria(${idxGrupo})">+ Agregar materia</button></div>`;
        return;
    }

    materias.forEach((materia, idxMateria) => {
        const materiaDiv = document.createElement("div");
        materiaDiv.classList.add("contenedor-materia-parcial");
        materiaDiv.innerHTML = `
            <div class="contenedor-materia-acciones">
                <span class="nombreMateria">${materia.nombre}</span>
                <div class="acciones-materia">
                    <button class="btn-eliminar-materia" onclick="eliminarMateria(${idxGrupo}, ${idxMateria})" title="Eliminar materia">
                        <img src="/static/img/cerrar_boton.png" alt="Eliminar" style="width: 16px; height: 16px;">
                    </button>
                    <button class="btn-editar-materia" onclick="editarMateria(${idxGrupo}, ${idxMateria})" title="Editar materia">
                        <img src="/static/img/editar_boton.png" alt="Editar" style="width: 16px; height: 16px;">
                    </button>
                </div>
            </div>
            <div class="parciales-container" id="parciales-${idxGrupo}-${idxMateria}"></div>
            <div class="acciones-parcial-global">
                <button class="btn-agregarParcial" onclick="agregarParcial(${idxGrupo}, ${idxMateria})">+ Añadir parcial</button>
            </div>
        `;
        container.appendChild(materiaDiv);
        renderizarParciales(materia.parciales, idxGrupo, idxMateria);
    });
}

// ==========================================
// RENDERIZAR PARCIALES (sin progresiones embebidas)
// ==========================================
function renderizarParciales(parciales, idxGrupo, idxMateria) {
    const container = document.getElementById(`parciales-${idxGrupo}-${idxMateria}`);
    if (!container) return;
    container.innerHTML = "";
    if (!parciales || parciales.length === 0) return;

    parciales.forEach((parcial, idxParcial) => {
        const parcialChip = document.createElement("div");
        parcialChip.classList.add("parcial-chip");
        parcialChip.innerHTML = `
            <div class="parcial-info">
                <button class="parcial-texto" onclick="irAProgresiones(${idxGrupo}, ${idxMateria}, ${idxParcial})">
                    ${parcial.nombre}
                </button>
                <div class="acciones-parcial">
                    <button class="btn-eliminarParcial" onclick="eliminarParcial(${idxGrupo}, ${idxMateria}, ${idxParcial})" title="Eliminar parcial">
                        <img src="/static/img/cerrar_boton.png" alt="Eliminar" style="width: 14px; height: 14px;">
                    </button>
                    <button class="btn-editarParcial" onclick="editarParcial(${idxGrupo}, ${idxMateria}, ${idxParcial})" title="Editar parcial">
                        <img src="/static/img/editar_boton.png" alt="Editar" style="width: 14px; height: 14px;">
                    </button>
                </div>
            </div>
        `;
        container.appendChild(parcialChip);
    });
}

// ==========================================
// REDIRECCIÓN A PROGRESIONES
// ==========================================
function irAProgresiones(idxGrupo, idxMateria, idxParcial) {
    const contexto = {
        grupo: idxGrupo,
        materia: idxMateria,
        parcial: idxParcial
    };
    localStorage.setItem("progresionContexto", JSON.stringify(contexto));
    window.location.href = "/progresiones";
}

// ==========================================
// FUNCIONES DE CRUD (LLAMADAS AL BACKEND)
// ==========================================
function agregarMateria(idxGrupo) {
    const nombre = prompt("Nombre de la materia:");
    if (!nombre) return;
    fetch("/api/crear_materia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: idxGrupo, materia: nombre })
    })
    .then(r => r.json())
    .then(data => {
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje);
    });
}

function editarMateria(idxGrupo, idxMateria) {
    const nuevoNombre = prompt("Nuevo nombre de la materia:");
    if (!nuevoNombre) return;
    alert("Función en desarrollo. Por ahora, puedes eliminar y volver a crear.");
}

function eliminarMateria(idxGrupo, idxMateria) {
    if (!confirm("¿Eliminar esta materia? Se perderán también sus parciales y progresiones.")) return;
    fetch("/api/eliminar_elemento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: idxGrupo, materia: idxMateria })
    })
    .then(r => r.json())
    .then(data => {
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje);
    });
}

function agregarParcial(idxGrupo, idxMateria) {
    const nombre = prompt("Nombre del parcial (ej. Parcial 1):");
    if (!nombre) return;
    fetch("/api/crear_parcial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: idxGrupo, materia: idxMateria, nombre: nombre })
    })
    .then(r => r.json())
    .then(data => {
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje);
    });
}

function editarParcial(idxGrupo, idxMateria, idxParcial) {
    const nuevoNombre = prompt("Nuevo nombre del parcial:");
    if (!nuevoNombre) return;
    alert("Función en desarrollo.");
}

function eliminarParcial(idxGrupo, idxMateria, idxParcial) {
    if (!confirm("¿Eliminar este parcial? Se perderán también sus progresiones.")) return;
    fetch("/api/eliminar_elemento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: idxGrupo, materia: idxMateria, parcial: idxParcial })
    })
    .then(r => r.json())
    .then(data => {
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje);
    });
}

function eliminarGrupo(idxGrupo) {
    if (!confirm("¿Eliminar todo el grupo? Esta acción es permanente.")) return;
    fetch("/api/eliminar_elemento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupo: idxGrupo })
    })
    .then(r => r.json())
    .then(data => {
        if (data.exito) cargarYElegirSeccion();
        else alert(data.mensaje);
    });
}

// ==========================================
// CARGA GRUPOS Y DECIDE QUÉ SECCIÓN MOSTRAR
// ==========================================
function cargarYElegirSeccion() {
    console.log("=== cargarYElegirSeccion: iniciando petición a /api/grupos ===");
    fetch("/api/grupos")
        .then(response => response.json())
        .then(grupos => {
            console.log("Respuesta de /api/grupos:", grupos);
            if (grupos.length === 0) {
                console.log("No hay grupos. Mostrando seccionDefault.");
                localStorage.removeItem("seccionActiva");
                mostrarSeccion("seccionDefault");
                document.getElementById("listaGrupos").innerHTML = "";
            } else {
                console.log(`Hay ${grupos.length} grupos. Renderizando...`);
                renderizarGrupos(grupos);
                mostrarSeccion("mostrarGrupos");
            }
        })
        .catch(error => {
            console.error("Error cargando grupos:", error);
            mostrarSeccion("seccionDefault");
        });
}

function mostrarSeccion(id) {
    document.querySelectorAll(".seccion").forEach(sec => sec.classList.remove("activa"));
    const sec = document.getElementById(id);
    if (sec) sec.classList.add("activa");
    localStorage.setItem("seccionActiva", id);
}

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
    cargarYElegirSeccion();
});