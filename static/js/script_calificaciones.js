// 1. Definimos datos de prueba por si el localStorage está vacío
const datosIniciales = {
    "Programación 401": [],
    "Matemáticas 204": []
};

// 2. Intentamos cargar de localStorage, si no hay nada, usamos los datos iniciales
let gruposSistema = JSON.parse(localStorage.getItem("gruposSistema"));

if (!gruposSistema || Object.keys(gruposSistema).length === 0) {
    gruposSistema = datosIniciales;
    localStorage.setItem("gruposSistema", JSON.stringify(gruposSistema));
}

let grupoActual = null;
let parcialActual = 1;
// ... resto del código

/*let gruposSistema = JSON.parse(localStorage.getItem("gruposSistema")) || {};
let grupoActual = null;
let parcialActual = 1;
*/
document.addEventListener("DOMContentLoaded", () => {
    renderizarGrupos();
    
    // Navegación del menú lateral
    document.querySelectorAll(".menu li").forEach(item => {
        item.addEventListener("click", function() {
            const section = this.getAttribute("data-section");
            navegarA(section);
        });
    });

    // Lector de archivos T.O.R.O
    document.getElementById('file-input').addEventListener('change', leerReporteTORO);
});

function navegarA(id) {
    document.querySelectorAll(".menu li").forEach(li => li.classList.toggle("active", li.getAttribute("data-section") === id));
    document.querySelectorAll(".section").forEach(sec => sec.classList.toggle("active", sec.id === `${id}-section`));
    document.getElementById("page-title").textContent = id.charAt(0).toUpperCase() + id.slice(1);
}

function crearGrupo() {
    const nombre = prompt("Nombre del nuevo grupo:");
    if (!nombre) return;
    gruposSistema[nombre] = [];
    guardarYRenderizar();
}

function leerReporteTORO(e) {
    const archivo = e.target.files[0];
    if (!archivo || !grupoActual) {
        alert("Selecciona primero un grupo y parcial en la tabla.");
        e.target.value = '';
        return;
    }

    const lector = new FileReader();
    lector.onload = function(e) {
        const contenido = e.target.result;
        // Extrae Nombre y Promedio Acumulado del reporte 
        const nombreMatch = contenido.match(/Nombre:\s+(.+)/);
        const calificacionMatch = contenido.match(/Promedio Acumulado:\s+([\d.]+)/);

        if (nombreMatch && calificacionMatch) {
            const nombreAlumno = nombreMatch[1].trim();
            const calificacion = parseFloat(calificacionMatch[1]);
            procesarCargaAutomatica(nombreAlumno, calificacion);
        } else {
            alert("Formato de reporte T.O.R.O. no reconocido.");
        }
    };
    lector.readAsText(archivo);
}

function procesarCargaAutomatica(nombre, nota) {
    let alumno = gruposSistema[grupoActual].find(a => a.nombre === nombre);
    if (!alumno) {
        alumno = { nombre: nombre, calificaciones: [0,0,0,0,0,0,0,0] };
        gruposSistema[grupoActual].push(alumno);
    }

    // El reporte del alumno se asigna a la primera posición del parcial activo 
    let indice = (parcialActual - 1) * 3; 
    alumno.calificaciones[indice] = nota;

    guardarYRenderizar();
    cargarTabla(grupoActual);
    alert(`Calificación de ${nombre} actualizada en Parcial ${parcialActual}`);
}

function renderizarGrupos() {
    // Lista de IDs de los contenedores donde quieres que aparezcan los grupos
    const contenedores = ["groups-container", "calificaciones-groups-container"];
    
    contenedores.forEach(id => {
        const cont = document.getElementById(id);
        if (!cont) return;
        cont.innerHTML = "";

        Object.keys(gruposSistema).forEach(grupo => {
            const card = document.createElement("div");
            card.className = "group-card";
            
            // Si el contenedor es el de grupos, mostramos info general
            // Si es el de calificaciones, mostramos los botones de parciales
            if (id === "groups-container") {
                card.innerHTML = `
                    <h3><i class="fas fa-users"></i> ${grupo}</h3>
                    <p>Alumnos inscritos: ${gruposSistema[grupo].length}</p>
                    <p style="margin-top:10px; font-size: 12px; color: var(--azul-medio);">
                        Haga clic en 'Calificaciones' para gestionar notas
                    </p>
                `;
            } else {
                card.innerHTML = `
                    <h3>${grupo}</h3>
                    <div class="parciales-botones">
                        <button onclick="abrirParcial('${grupo}', 1)">P1</button>
                        <button onclick="abrirParcial('${grupo}', 2)">P2</button>
                        <button onclick="abrirParcial('${grupo}', 3)">P3</button>
                    </div>`;
            }
            cont.appendChild(card);
        });
    });
}

function abrirParcial(grupoId, parcial) {
    grupoActual = grupoId;
    parcialActual = parcial;
    document.getElementById("calificaciones-grupos-view").style.display = "none";
    document.getElementById("calificaciones-tabla-view").style.display = "block";
    cargarTabla(grupoId);
}

function cargarTabla(grupoId) {
    const tablaBody = document.getElementById("grades-table-body");
    const headerRow = document.getElementById("table-header-row");
    const alumnos = gruposSistema[grupoId] || [];
    
    // Configurar encabezados dinámicos (01, 02, 03 por parcial)
    headerRow.innerHTML = "<th>Alumno</th><th>01</th><th>02</th><th>03</th>";
    tablaBody.innerHTML = "";
    document.querySelector(".parcial-info h3").textContent = `${grupoId} - Parcial ${parcialActual}`;

    alumnos.forEach(alumno => {
        const fila = document.createElement("tr");
        let inicio = (parcialActual - 1) * 3;
        let fin = parcialActual === 3 ? 8 : inicio + 3;
        
        let html = `<td class="student-name">${alumno.nombre}</td>`;
        alumno.calificaciones.slice(inicio, fin).forEach(cal => {
            const color = cal >= 9 ? "grade-high" : (cal >= 6 ? "grade-medium" : "grade-low");
            html += `<td class="grade-cell ${color}">${cal}</td>`;
        });
        fila.innerHTML = html;
        tablaBody.appendChild(fila);
    });
}

function regresarAGrupos() {
    document.getElementById("calificaciones-grupos-view").style.display = "block";
    document.getElementById("calificaciones-tabla-view").style.display = "none";
    grupoActual = null;
}

function guardarYRenderizar() {
    localStorage.setItem("gruposSistema", JSON.stringify(gruposSistema));
    renderizarGrupos();
}