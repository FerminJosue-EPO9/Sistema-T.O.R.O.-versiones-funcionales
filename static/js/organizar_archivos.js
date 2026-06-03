// js/organizar_archivos.js
const tipoLeccion = document.getElementById("tipoLeccion");
const formulario = document.getElementById("formActividad");
const contenedorSelector = document.getElementById("selectorExistente");
const btnGuardar = document.getElementById("btnGuardar");
const listaArchivos = document.getElementById("archivoNombre");

// 1. Cargar archivos del almacenamiento temporal
const rutas = JSON.parse(sessionStorage.getItem("rutasTemporales") || "[]");
listaArchivos.innerHTML = rutas.map(r => `<span>${r.split(/[\\/]/).pop()}</span>`).join(", ");

// 2. Manejar cambio entre Nueva / Existente
tipoLeccion.addEventListener("change", async () => {
    const esExistente = tipoLeccion.value === "Existente";
    formulario.style.display = esExistente ? "none" : "block";
    contenedorSelector.innerHTML = "";

    if (esExistente) {
        const lecciones = await window.pywebview.api.obtener_lecciones_existentes();
        const select = document.createElement("select");
        select.id = "selectCarpeta";
        lecciones.forEach(l => {
            const opt = document.createElement("option");
            opt.value = l; opt.textContent = l;
            select.appendChild(opt);
        });
        contenedorSelector.appendChild(select);
    }
});

// 3. Guardar Datos
btnGuardar.addEventListener("click", async () => {
    const esNueva = tipoLeccion.value === "Nueva";
    let data = {
        rutas: rutas,
        es_nueva: esNueva
    };

    if (esNueva) {
        data.grupo = document.querySelector('[name="grupo"]').value;
        data.materia = document.querySelector('[name="materia"]').value;
        data.parcial = document.querySelector('[name="parcial"]').value;
        data.tema = document.querySelector('[name="tema"]').value;
        data.actividad = document.querySelector('[name="nombreActividad"]').value;

        if (!data.actividad) return alert("Escribe el nombre de la actividad");
    } else {
        const select = document.getElementById("selectCarpeta");
        if (!select) return alert("No hay lecciones seleccionadas");
        data.carpeta_existente = select.value;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "Procesando...";

    const respuesta = await window.pywebview.api.guardar_leccion(data);
    
    alert(respuesta.mensaje);
    
    if (respuesta.success) {
        sessionStorage.clear();
        window.location.href = (await window.pywebview.api.obtener_ruta_formulario()).replace("organizar_archivos.html", "index.html");
    } else {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Crear contenido de la actividad";
    }
});