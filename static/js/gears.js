// js/gears.js
const btnSeleccionar = document.getElementById("btnSeleccionar");
const btnContinuar = document.getElementById("btnContinuar");
const infoArchivo = document.getElementById("infoArchivo");
const estado = document.getElementById("estado");

let rutasSeleccionadas = [];

btnSeleccionar.addEventListener("click", async () => {
    try {
        const rutas = await window.pywebview.api.seleccionar_archivos();
        
        if (rutas && rutas.length > 0) {
            rutasSeleccionadas = [...new Set([...rutasSeleccionadas, ...rutas])]; // Evita duplicados
            sessionStorage.setItem("rutasTemporales", JSON.stringify(rutasSeleccionadas));
            
            // Actualizar Interfaz
            infoArchivo.innerHTML = rutasSeleccionadas
                .map(r => `<p>📄 ${r.split(/[\\/]/).pop()}</p>`)
                .join("");
            
            estado.textContent = `${rutasSeleccionadas.length} archivo(s) listos.`;
            btnContinuar.disabled = false;
        }
    } catch (err) {
        console.error("Error al seleccionar:", err);
    }
});

btnContinuar.addEventListener("click", async () => {
    // Le pedimos la ruta a Python para asegurar que sea válida
    const urlFormulario = await window.pywebview.api.obtener_ruta_formulario();
    window.location.href = urlFormulario;
});