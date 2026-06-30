
// ==========================================
// VARIABLES GLOBALES 
// ==========================================
// Aquí guardo las referencias a las cajas (divs) del HTML para no buscarlas a cada rato
const vistaGrupos = document.getElementById('vista-grupos');           // La pantalla inicial
const vistaSeleccion = document.getElementById('vista-seleccion');     // Las 3 tarjetas de colores
const vistaGraficos = document.getElementById('vista-graficos');       // Donde sale la gráfica
const vistaListaAlumnos = document.getElementById('vista-lista-alumnos'); // Lista de nombres
const vistaTablaActividades = document.getElementById('vista-tabla-actividades'); // Tabla de tareas
const vistaMaterias = document.getElementById('vista-materias');
const vistaParciales = document.getElementById('vista-parciales');
const migasPan = document.getElementById('migas-pan');                 // El texto de arriba (Estadísticas > Grupo...), breadcrumbs

// Variables de memoria para saber qué está pasando
let graficoActual = null;     // Aquí se guarda la gráfica para poder borrarla antes de dibujar una nueva
let grupoSeleccionado = '';   // Para recordar en qué grupo di clic (ej: "401-A")
let descripcionGrupo = '';    // Para recordar el nombre (ej: "4to Semestre")

let materiaSeleccionada = '';
let parcialSeleccionado = '';

let ultimoTipoGrafico = '';

let leccionSeleccionada = '';

let alumnoSeleccionado = '';
let matriculaSeleccionada = '';
// ==========================================
// 3. LÓGICA DE CÁLCULO DE GRAFICOS
// ==========================================

// A. Función para el la gráfica de actividades
// Recibe una lista revuelta de notas y cuenta: Cuántos sacaron 0?, Cuántos 1? ..., etcétera
function calcularFrecuenciaNotas(listaNotas) {
    // Creación de 11 cajitas vacías (del 0 al 10) y les pone un cero a todas
    let conteo = new Array(11).fill(0); 
    
    // Revisión de nota por nota...
    listaNotas.forEach(nota => {
        let valor = Math.round(nota); // Redondeo de calif
        
        // Si es una calificación válida (0-10), le sumo un puntito a su cajita correspondiente
        if(valor >= 0 && valor <= 10) {
            conteo[valor]++; 
        }
    });
    return conteo; // Devuelvo las cajitas ya con los totales
}

// B. Función para calcular promedios
// Suma todos los números y los divide entre la cantidad de números
function calcularPromedio(listaNumeros) {
    if (listaNumeros.length === 0) return 0; // Evita errores si la lista está vacía
    const suma = listaNumeros.reduce((a, b) => a + b, 0); // Suma todo
    return (suma / listaNumeros.length).toFixed(1); // Divide y corta a 1 solo decimal
}

function corregirProgresion(texto) {
    if (!texto) return '(Sin progresión)';

    return texto.trim()
        .replace(/ProgresiÀ³n/g, 'Progresión')
        .replace(/progresiÀ³n/g, 'progresión');
}

// C. Función para sacar promedios de cada lección
// Recibe la matriz grande y le aplica la función de arriba a cada renglón
function procesarPromediosGrupo(matrizLecciones) {
    return matrizLecciones.map(leccion => calcularPromedio(leccion));
}

// ==========================================
// 4. FUNCIONES DE CARGA o puente de datos
// ==========================================
// Estas funciones toman los datos de arriba y crean el HTML necesario como botones, tablas, etcétera

//Carga inicial de grupos
async function cargarListaGrupos() {

    const contenedor =
        document.querySelector('.lista-scroll');

    contenedor.innerHTML = '';

    const respuesta =
        await fetch('/api/estadisticas/grupos');

    const grupos =
        await respuesta.json();

    if (grupos.length === 0) {

        contenedor.innerHTML = `
            <div class="cal-empty-state">
                <p>No hay grupos registrados.</p>
                <p>Registra uno para visualizar estadísticas.</p>

                <a href="/grupos" class="btn-redirect">
                    Ir a Grupos
                </a>
            </div>
        `;

        return;
    }

    grupos.forEach(grupo => {

        const item =
            document.createElement('div');

        item.className = 'item-grupo';

        item.onclick = () =>
            seleccionarGrupo(
                grupo.nombre,
                grupo.nombre
            );

        item.innerHTML = `
            <span class="id-grupo">
                ${grupo.nombre}
            </span>
            <span class="desc-grupo">
                ${grupo.alumnos.length} alumnos
            </span>
        `;

        contenedor.appendChild(item);
    });

    window.gruposReales = grupos;
}

async function obtenerCalificacionesReales() {

    const respuesta =
        await fetch(
            `/api/estadisticas/calificaciones?grupo=${encodeURIComponent(grupoSeleccionado)}&materia=${encodeURIComponent(materiaSeleccionada)}&parcial=${encodeURIComponent(parcialSeleccionado)}`
        );

    return await respuesta.json();
}

function cargarListaMaterias(grupoId) {

    const contenedor =
        document.getElementById(
            'lista-materias'
        );

    contenedor.innerHTML = '';

    const grupo =
        window.gruposReales.find(
            g => g.nombre === grupoId
        );

    if (!grupo) return;

    if (!grupo.materias || grupo.materias.length === 0) {
       contenedor.classList.remove('grid-alumnos');

        contenedor.innerHTML = `
            <div class="cal-empty-state">
                <p>No hay materias registradas.</p>
                <p>Agrega una materia para visualizar estadísticas.</p>

                <a href="/grupos" class="btn-redirect">
                    Ir a Grupos
                </a>
            </div>
        `;

        return;
    }
    contenedor.classList.add('grid-alumnos');

    grupo.materias.forEach(materia => {

        const btn =
            document.createElement('button');

        btn.className = 'btn-alumno';

        btn.innerText =
            materia.nombre;

        btn.onclick = () =>
            seleccionarMateria(
                materia.nombre
            );

        contenedor.appendChild(btn);
    });
}

function ocultarTodasLasVistas() {

    vistaGrupos.style.display = 'none';
    vistaMaterias.style.display = 'none';
    vistaParciales.style.display = 'none';
    vistaSeleccion.style.display = 'none';
    vistaListaAlumnos.style.display = 'none';
    vistaTablaActividades.style.display = 'none';
    vistaGraficos.style.display = 'none';

}

function seleccionarMateria(nombreMateria) {
    materiaSeleccionada = nombreMateria;
    ocultarTodasLasVistas();

    vistaParciales.style.display = 'flex';
    cargarListaParciales();
    actualizarMigas(2);
}

function cargarListaParciales() {

    const contenedor =
        document.getElementById(
            'lista-parciales'
        );

    contenedor.innerHTML = '';

    const grupo =
        window.gruposReales.find(
            g => g.nombre === grupoSeleccionado
        );

    if (!grupo) return;

    const materia =
        grupo.materias.find(
            m => m.nombre === materiaSeleccionada
        );

    if (!materia.parciales || materia.parciales.length === 0) {
        contenedor.classList.remove('grid-alumnos');
        contenedor.innerHTML = `
            <div class="cal-empty-state">
                <p>No hay parciales registrados.</p>
                <p>Agrega un parcial para visualizar estadísticas.</p>

                <a href="/grupos" class="btn-redirect">
                    Ir a Grupos
                </a>
            </div>
        `;

        return;
    }

    contenedor.classList.add('grid-alumnos');

    if (!materia) return;

    materia.parciales.forEach(parcial => {

        const btn =
            document.createElement('button');

        btn.className =
            'btn-alumno';

        btn.innerText =
            parcial.nombre;

        btn.onclick = () =>
            seleccionarParcial(
                parcial.nombre
            );

        contenedor.appendChild(btn);
    });
}

async function seleccionarParcial(nombreParcial) {
    parcialSeleccionado = nombreParcial;

    ocultarTodasLasVistas();

    vistaSeleccion.style.display = 'flex';

    cargarListaAlumnos(grupoSeleccionado);
    await cargarListaActividades();
console.log("Parcial seleccionado:", parcialSeleccionado);
    actualizarMigas(3);
}
function regresarAMaterias() {
    ocultarTodasLasVistas();
    vistaMaterias.style.display = 'flex';
    parcialSeleccionado = '';
    actualizarMigas(1);
}

function regresarAParciales() {
    ocultarTodasLasVistas();
    vistaParciales.style.display = 'flex';
    actualizarMigas(2);
}

// Carga los botones con 
// los nombres de los alumnos
function cargarListaAlumnos(grupoId) {

    const contenedor =
        document.getElementById(
            'lista-alumnos'
        );

    contenedor.innerHTML = '';

    const grupo =
        window.gruposReales.find(
            g => g.nombre === grupoId
        );

    if (!grupo) return;

    grupo.alumnos.forEach(alumno => {

        const btn =
            document.createElement('button');

        btn.className =
            'btn-alumno';

        btn.innerText =
            `${alumno.nombres} ${alumno.apellidos}`;

        btn.onclick = () =>
            verGraficoAlumno(
            alumno.matricula,
            `${alumno.nombres} ${alumno.apellidos}`
        );

        contenedor.appendChild(btn);
    });
}

// Carga la tabla de actividades
async function cargarListaActividades() {

    const tbody =
        document.querySelector('.tabla-actividades tbody');

    tbody.innerHTML = '';

    const registros =
        await obtenerCalificacionesReales();

    console.log("Grupo:", grupoSeleccionado);
    console.log("Materia:", materiaSeleccionada);
    console.log("Parcial:", parcialSeleccionado);
    console.log("Registros:", registros);

    const actividadesUnicas = {};

    registros.forEach(registro => {

        if (!actividadesUnicas[registro.idLeccion]) {

            actividadesUnicas[registro.idLeccion] = {
                idLeccion: registro.idLeccion,
                actividad: registro.actividad,
                progresion: corregirProgresion(registro.progresion)

            };
        }
    });

    const actividades = Object.values(actividadesUnicas);

    if (actividades.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="2">
                    <div class="estado-vacio-lecciones">
                        <p>Aún no hay ninguna lección para ver estadísticas.</p>
                        <p>Suba los archivos de los alumnos para visualizar las calificaciones de las lecciones.</p>

                        <button
                            class="btn-ir-calificaciones"
                            onclick="window.location.href='/calificaciones'">
                            Ir a Calificaciones
                        </button>
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    actividades.forEach(act => {

        const fila = document.createElement('tr');

        fila.onclick = () =>
            verGraficoActividad(
                act.idLeccion,
                act.progresion
            );

        fila.innerHTML = `
            <td>${act.idLeccion}</td>
            <td>${act.progresion}</td>
        `;

        tbody.appendChild(fila);
    });
}
// ==========================================
// 5. NAVEGACIÓN 
// ==========================================

// Lo primero que se ejecuta
document.addEventListener('DOMContentLoaded', () => {
    cargarListaGrupos(); // Muestra la lista de grupos inicial
});

// Controla el texto de arriba Estadísticas > 401-A > Alumnos
function actualizarMigas(nivel, seccion = '', detalle = '') {
    let ruta = `<span class="enlace-miga" onclick="irInicio()">Estadísticas</span>`;

    // NIVEL 1 -> Grupo
    if (nivel >= 1) {
        ruta += ` > <span class="enlace-miga"
                    onclick="regresarAGrupos()">
                    ${grupoSeleccionado}
                  </span>`;
    }

    // NIVEL 2 -> Materia
    if (nivel >= 2) {
        ruta += ` > <span class="enlace-miga"
                    onclick="regresarAMaterias()">
                    ${materiaSeleccionada}
                  </span>`;
    }

    // NIVEL 3 -> Parcial
    if (nivel >= 3) {
        ruta += ` > <span class="enlace-miga"
                    onclick="regresarAParciales()">
                    ${parcialSeleccionado}
                </span>`;
    }

    // NIVEL 4 -> Lecciones / Alumnos / Grupos
    if (nivel >= 4) {
        if (nivel === 5) {
            const funcionVolver =
                seccion === 'Alumnos'
                    ? "volverALista('alumno')"
                    : "volverALista('actividad')";

            ruta += ` > <span class="enlace-miga"
                        onclick="${funcionVolver}">
                        ${seccion}
                      </span>`;

        } else {
            ruta += ` > <span class="enlace-miga">
                        ${seccion}
                      </span>`;
        }
    }

    // NIVEL 5 -> Nombre del alumno o actividad
    if (nivel === 5) {
        ruta += ` > <span>${detalle}</span>`;
    }

    migasPan.innerHTML = ruta;
}

// Eleccíón de grupo
function seleccionarGrupo(id, descripcion) {
    grupoSeleccionado = id;
    descripcionGrupo = descripcion;

    ocultarTodasLasVistas();
    vistaMaterias.style.display = 'flex';
    cargarListaMaterias(id);
    actualizarMigas(1);
}

// Elección de tarjetas
async function cargarGrafico(tipo) {
    ocultarTodasLasVistas();
    
    if (tipo === 'alumno') {
        vistaListaAlumnos.style.display = 'flex'; // Muestra lista alumnos
        actualizarMigas(4, 'Alumnos');
        
    } else if (tipo === 'actividad') {
        vistaTablaActividades.style.display = 'flex'; // Muestra tabla tareas
        actualizarMigas(4, 'Lecciones');
        
    } else if (tipo === 'grupo') {
        // El promedio general va directo a la gráfica y nadamás
        await mostrarCanvasFinal('grupo', 'Promedio General', 'Promedio del Grupo');
        actualizarMigas(4, 'Grupos'); 
    }
}

// Funciones intermedias para ir a la gráfica final
async function verGraficoAlumno(matricula, nombreAlumno) {
    alumnoSeleccionado = matricula;
    matriculaSeleccionada = matricula;

    vistaListaAlumnos.style.display = 'none';
    actualizarMigas(5, 'Alumnos', nombreAlumno); 
    await mostrarCanvasFinal( 'alumno', nombreAlumno,'' );
}

async function verGraficoActividad(idLeccion, progresion) {
    leccionSeleccionada = idLeccion;
    vistaTablaActividades.style.display = 'none';

    actualizarMigas(
        5,
        'Lecciones',
        idLeccion
    );

    await mostrarCanvasFinal(
        'actividad',
        idLeccion,
        progresion
    );
}

// ==========================================
// 6. GRÁFICAS CON LA LIBRERÍA DE CHART.JS
// ==========================================

async function mostrarCanvasFinal(tipo, nombreDato, detalleExtra) {
    ultimoTipoGrafico = tipo;
    vistaGraficos.style.display = 'flex'; // Muestra el contenedor del gráfico
    
    //Llena los textos informativos arriba del gráfico
    const elGrupo = document.getElementById('grafico-grupo');
    if(elGrupo) elGrupo.innerText = `Grupo ${grupoSeleccionado}`;
    
    const spanDato = document.getElementById('grafico-dato-especifico');
    const spanMateria = document.getElementById('grafico-materia');
    if (spanMateria) {
        spanMateria.innerText = materiaSeleccionada;
    }

    // Cambia las etiquetas según lo que se está viendo
    if (tipo === 'alumno') {
        spanDato.innerHTML = `
            <p>
                <span class="etiqueta-negrita">Alumno:</span>
                ${nombreDato}
            </p>

            <p>
                <span class="etiqueta-negrita">Matrícula:</span>
                ${matriculaSeleccionada}
            </p>
        `;
    } else if (tipo === 'actividad') {
        spanDato.innerHTML = `
            <p>
                <span class="etiqueta-negrita">Actividad:</span>
                ${nombreDato}
            </p>

            <p>
                <span class="etiqueta-negrita">Progresión:</span>
                ${detalleExtra}
            </p>
        `;
    }else {
        spanDato.innerHTML = `
            <p>
                <span class="etiqueta-negrita">Vista:</span>
                General del Grupo
            </p>
        `;
    }

    // Prepara el lienzo o canvas
    const ctx = document.getElementById('miGrafico').getContext('2d');
    
    // IMPORTANTE, Si ya había un gráfico dibujado antes, lo destruye para no encimarlos
    if (graficoActual) graficoActual.destroy();

    let maximoEjeY = 10; // Valor máximo del eje Y, se ajustará según el tipo de gráfico
    //PREPARACIÓN DE DATOS 
    let datosGrafico, etiquetas, colorBarra, labelDataset;
    let textoEjeX, textoEjeY; // Los títulos de los ejes X e Y
    
    // OPCIÓN A: GRÁFICO DE ALUMNO
    if (tipo === 'alumno') {
        maximoEjeY = 10;
        const registros =
            await obtenerCalificacionesReales();

        const registrosAlumno =
            registros.filter(
                r => r.matricula === alumnoSeleccionado
            );

        registrosAlumno.sort((a, b) =>
            a.idLeccion.localeCompare(b.idLeccion)
        );

        etiquetas =
            registrosAlumno.map(
                r => r.idLeccion
            );

        datosGrafico =
        registrosAlumno.map(r => {

            const intentos = r.intentos || [];

            if (intentos.length === 0) {
                return 0;
            }

            return parseFloat(
                intentos[intentos.length - 1].calificacion || 0
            );
        });

        colorBarra = '#3E8E41';

        labelDataset = 'Calificación';

        textoEjeX = 'Lección';

        textoEjeY = 'Calificación';
    } else if (tipo === 'actividad') {
        const registros =
            await obtenerCalificacionesReales();

        const registrosLeccion =
            registros.filter(
                r => r.idLeccion === leccionSeleccionada
            );

        const totalAlumnos = registrosLeccion.length;
        maximoEjeY = totalAlumnos;

        const frecuencias = Array(11).fill(0);

        registrosLeccion.forEach(registro => {
            const intentos = registro.intentos || [];

            let calificacion = 0;

            if (intentos.length > 0) {

                calificacion =
                    Math.round(
                        parseFloat(
                            intentos[intentos.length - 1].calificacion || 0
                        )
                    );
            }

            if (calificacion >= 0 && calificacion <= 10) {
                frecuencias[calificacion]++;
            }
        });

        datosGrafico = frecuencias;

        etiquetas = [
            '0','1','2','3','4',
            '5','6','7','8','9','10'
        ];

        colorBarra = '#77ab83';

        labelDataset ='Cantidad de alumnos';

        textoEjeX = 'Calificación';

        textoEjeY = 'Cantidad de alumnos';
    } else {

        const registros =
            await obtenerCalificacionesReales();
        
        maximoEjeY = 10;

        const promediosPorLeccion = {};

        registros.forEach(registro => {

            const idLeccion =
                registro.idLeccion;

           const intentos =
            registro.intentos || [];

            let promedio = 0;

            if (intentos.length > 0) {

                promedio =
                    parseFloat(
                        intentos[intentos.length - 1].calificacion || 0
                    );
            }

            if (!promediosPorLeccion[idLeccion]) {

                promediosPorLeccion[idLeccion] = [];
            }

            promediosPorLeccion[idLeccion].push(
                promedio
            );
        });

        etiquetas =
            Object.keys(promediosPorLeccion);

        datosGrafico =
            etiquetas.map(leccion => {

                const notas =
                    promediosPorLeccion[leccion];

                const suma =
                    notas.reduce(
                        (a, b) => a + b,
                        0
                    );

                return (
                    suma /
                    notas.length
                ).toFixed(2);
            });

        colorBarra = '#5a6eec';

        labelDataset = 'Promedio';

        textoEjeX = 'Lección';

        textoEjeY = 'Promedio';
    }

    // 4. CONFIGURACIÓN DE CHART.JS para darle instrucciones a la librería
    graficoActual = new Chart(ctx, {
        type: 'bar', // Tipo de gráfico --> barras
        data: {
            labels: etiquetas, // Lo que va abajo (eje X)
            datasets: [{
                label: labelDataset, // Lo que sale si pones el mouse encima
                data: datosGrafico,  // Los números a dibujar altura de barras
                backgroundColor: colorBarra, // Color de las barras
                borderRadius: 4, // Bordes redonditos en las barras
            }]
        },
        options: {
            responsive: true, // Que se adapte al tamaño de pantalla
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }, // Oculta la leyenda de arriba
            scales: {
                y: {
                    beginAtZero: true,

                    max: maximoEjeY,

                    ticks: {
                        stepSize: 1
                    },

                    title: {
                        display: true,
                        text: textoEjeY,
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        color: '#052672'
                    }
                },
                x: {
                    title: { 
                        display: true,
                        text: textoEjeX, // Pone el título del eje X
                        font: { weight: 'bold', size: 14 },
                        color: '#052672'
                    }
                }
            }
        }
    });
}

// FUNCIONES PARA LOS BOTONES PARA IR HACIA ATRÁS

// Funcionalidad de los todos los botones de atrás y regresar
function regresarASeleccion() {
    ocultarTodasLasVistas();
    vistaSeleccion.style.display = 'flex';
    actualizarMigas(3);
}

// Botón "Atrás" en la lista de gupos
function regresarAGrupos() {
    vistaSeleccion.style.display = 'none';
    vistaMaterias.style.display = 'none';
    vistaParciales.style.display = 'none';
    vistaListaAlumnos.style.display = 'none';
    vistaTablaActividades.style.display = 'none';
    vistaGraficos.style.display = 'none';

    vistaGrupos.style.display = 'flex';

    grupoSeleccionado = '';
    descripcionGrupo = '';
    materiaSeleccionada = '';
    parcialSeleccionado = '';

    actualizarMigas(0);
}

function regresarDesdeMaterias() {
    ocultarTodasLasVistas();
    vistaGrupos.style.display = 'flex';
    materiaSeleccionada = '';
    parcialSeleccionado = '';
    actualizarMigas(0);
}
// Botón en las migas para volver del gráfico a la lista anterior
function volverALista(tipo) {

    ocultarTodasLasVistas();

    if(graficoActual) {
        graficoActual.destroy();
    }

    if (tipo === 'alumno') {

        vistaListaAlumnos.style.display = 'flex';
        actualizarMigas(4, 'Alumnos');

    } else {

        vistaTablaActividades.style.display = 'flex';
        actualizarMigas(4, 'Lecciones');
    }
}

// Atajos para los botones HTML
function regresar() {

    if (graficoActual) {
        graficoActual.destroy();
    }

    if (ultimoTipoGrafico === 'alumno') {

        volverALista('alumno');

    } else if (ultimoTipoGrafico === 'actividad') {

        volverALista('actividad');

    } else if (ultimoTipoGrafico === 'grupo') {

        regresarASeleccion();
    }
}
function irInicio() { location.reload(); } // Recarga la página completa