// ==========================================
// 1. ZONA DE DATOS DE PRUEBA
// ==========================================
/*  La variable 'dbSimulada' es como una base de datos de prueba. 
   Se crea para que el sistema funcione ahorita que no tiene conexión 
   con los datos reales. 
   Cuando se conecte se borrará se usará la información que llegue desde el servidor
*/
const dbSimulada = {
    // Lista de grupos disponibles (como si vinieran del almacén)
    grupos: [
        { id: '401-A', nombre: '4to Semestre' },
        { id: '604-B', nombre: '6to Semestre' },
        { id: '202-C', nombre: '2do Semestre' }
    ],
    // Lista de alumnos organizados por el ID de su grupo
    alumnos: {
        '401-A': [
            { id: 1, nombre: 'Selina del Mar Cruz Jacinto' },
            { id: 2, nombre: 'Angel Jharamy Cruz Licea' },
            { id: 3, nombre: 'Eduardo Garcia Medina' },
            { id: 4, nombre: 'Genesis Daniela Hernandez' }
        ],
        '604-B': [
            { id: 5, nombre: 'Josue Jimenez Fermin' },
            { id: 6, nombre: 'Denilson Alexis Rosado' }
        ]
    },
    // Tareas o actividades en cada grupo
    actividades: {
        '401-A': [
            { tipo: 'Crucigrama', tema: 'Condicionales', fecha: '23/03/2026', valor: 10 },
            { tipo: 'Sopa de letras', tema: 'Archivos', fecha: '24/01/2026', valor: 15 }
        ]
    },
    
    // PARA LAS GRÁFICAS 
    // Datos que usarán los cálculos
    datosBrutos: {
        
        // 1. Calificaciones individuales: Una lista de notas por cada lección 
        notasAlumnos: {
            'Selina del Mar Cruz Jacinto': [10, 9, 10, 8, 10, 9, 10, 10, 9, 10],
            'Angel Jharamy Cruz Licea': [8, 7, 9, 6, 8, 8, 7, 9, 8, 9],
            'default': [7, 6, 7, 8, 6, 7, 8, 6, 7, 8] // Notas genéricas por si el alumno no está en la lista
        },
        
        //Todas las calif
        notasActividad: [10, 8, 9, 10, 5, 8, 9, 10, 10, 6, 7, 8, 9, 10, 5, 4, 8, 9, 10, 8],

        notasPorLeccionGrupo: [
            [8, 9, 10, 7, 8],   // Notas de todos los alumnos en la Lección 1
            [9, 8, 9, 8, 9],    // Lección 2
            [7, 6, 8, 7, 6],    // Lección 3
            [10, 10, 9, 10, 9], // Lección 4
            [8, 8, 7, 8, 8]     // Lección 5
        ]
    }
};

// ==========================================
// 2. VARIABLES GLOBALES 
// ==========================================
// Aquí guardo las referencias a las cajas (divs) del HTML para no buscarlas a cada rato
const vistaGrupos = document.getElementById('vista-grupos');           // La pantalla inicial
const vistaSeleccion = document.getElementById('vista-seleccion');     // Las 3 tarjetas de colores
const vistaGraficos = document.getElementById('vista-graficos');       // Donde sale la gráfica
const vistaListaAlumnos = document.getElementById('vista-lista-alumnos'); // Lista de nombres
const vistaTablaActividades = document.getElementById('vista-tabla-actividades'); // Tabla de tareas
const migasPan = document.getElementById('migas-pan');                 // El texto de arriba (Estadísticas > Grupo...), breadcrumbs

// Variables de memoria para saber qué está pasando
let graficoActual = null;     // Aquí se guarda la gráfica para poder borrarla antes de dibujar una nueva
let grupoSeleccionado = '';   // Para recordar en qué grupo di clic (ej: "401-A")
let descripcionGrupo = '';    // Para recordar el nombre (ej: "4to Semestre")

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
function cargarListaGrupos() {
    // Busca el contenedor donde van los grupos
    const contenedor = document.querySelector('.lista-scroll');
    contenedor.innerHTML = ''; // Lo limpia por si tenía basura

    // -Después aquí se pedirán los datos reales con fetch()
    const grupos = dbSimulada.grupos; 
    
    // Por cada grupo en los datos, crea un cuadrito en la pantalla
    grupos.forEach(grupo => {
        const item = document.createElement('div'); // Crea el div
        item.className = 'item-grupo';              // Pone su clase CSS
        
        // Le dice qué hacer cuando le den clic: "Ejecuta seleccionarGrupo enviando mi ID"
        item.onclick = () => seleccionarGrupo(grupo.id, grupo.nombre);
        
        // Rellea el cuadrito con el texto
        item.innerHTML = `
            <span class="id-grupo">${grupo.id}</span>
            <span class="desc-grupo">${grupo.nombre}</span>
        `;
        contenedor.appendChild(item); // Lo pega en la pantalla
    });
}

// Carga los botones con los nombres de los alumnos
function cargarListaAlumnos(grupoId) {
    const contenedor = document.querySelector('.grid-alumnos');
    contenedor.innerHTML = ''; // Limpia lo anterior
    
    // Busca los alumnos de ESE grupo específico
    const alumnos = dbSimulada.alumnos[grupoId] || [];

    // Si no encuentra alumnos avisa
    if(alumnos.length === 0) {
        contenedor.innerHTML = '<p>No hay alumnos registrados (Simulación).</p>';
        return;
    }

    // Crea un botón por cada alumno
    alumnos.forEach(alumno => {
        const btn = document.createElement('button');
        btn.className = 'btn-alumno';
        btn.innerText = alumno.nombre;
        // Al dar clic, vamos a ver la gráfica personal de este alumno
        btn.onclick = () => verGraficoAlumno(alumno.nombre); 
        contenedor.appendChild(btn);
    });
}

// Carga la tabla de actividades
function cargarListaActividades(grupoId) {
    const tbody = document.querySelector('.tabla-actividades tbody');
    tbody.innerHTML = ''; // Limpia la tabla
    const actividades = dbSimulada.actividades[grupoId] || [];

    // Creo una fila tr por cada tarea
    actividades.forEach(act => {
        const fila = document.createElement('tr');
        // Al dar clic vemos la estadística de esa tarea específica
        fila.onclick = () => verGraficoActividad(act.tipo, act.tema);
        
        // Relleno las celdas td
        fila.innerHTML = `<td>${act.tipo}</td><td>${act.tema}</td><td>${act.fecha}</td><td>${act.valor} pts</td>`;
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
    // Nivel 0 empieza con "Estadísticas"
    let ruta = `<span class="enlace-miga" onclick="irInicio()">Estadísticas</span>`;
    
    // Nivel 1 el Grupo seleccionado
    if (nivel >= 1) ruta += ` > <span class="enlace-miga" onclick="regresarASeleccion()">${grupoSeleccionado}</span>`;
    
    // Nivel 2 la sección
    if (nivel >= 2) {
        if (nivel === 3) {
            // Si estamos viendo la gráfica, la palabra "Alumnos" se vuelve un enlace para volver atrás
            const funcionVolver = seccion === 'Alumnos' ? "volverALista('alumno')" : "volverALista('actividad')";
            ruta += ` > <span class="enlace-miga" onclick="${funcionVolver}">${seccion}</span>`;
        } else {
            // Si solo estamos en la lista, es texto normal
            ruta += ` > <span class="enlace-miga">${seccion}</span>`;
        }
    }
    
    // Nivel 3 el nombre final del alumno o tarea
    if (nivel === 3) ruta += ` > <span>${detalle}</span>`;
    
    migasPan.innerHTML = ruta; // Pinta el texto en el HTML
}

// Eleccíón de grupo
function seleccionarGrupo(id, descripcion) {
    grupoSeleccionado = id;
    descripcionGrupo = descripcion;
    
    // Oculta lista de grupos --> Muestra tarjetas de colores
    vistaGrupos.style.display = 'none';
    vistaSeleccion.style.display = 'flex';
    
    // Aprovecha para cargar las listas de alumnos y tareas de este grupo
    cargarListaAlumnos(id);
    cargarListaActividades(id);
    
    actualizarMigas(1); 
}

// Elección de tarjetas
function cargarGrafico(tipo) {
    vistaSeleccion.style.display = 'none'; // Oculta selección
    
    if (tipo === 'alumno') {
        vistaListaAlumnos.style.display = 'flex'; // Muestra lista alumnos
        actualizarMigas(2, 'Alumnos');
        
    } else if (tipo === 'actividad') {
        vistaTablaActividades.style.display = 'flex'; // Muestra tabla tareas
        actualizarMigas(2, 'Lecciones');
        
    } else if (tipo === 'grupo') {
        // El promedio general va directo a la gráfica y nadamás
        mostrarCanvasFinal('grupo', 'Promedio General', 'Promedio del Grupo');
        actualizarMigas(2, 'Grupos'); 
    }
}

// Funciones intermedias para ir a la gráfica final
function verGraficoAlumno(nombreAlumno) {
    vistaListaAlumnos.style.display = 'none';
    actualizarMigas(3, 'Alumnos', nombreAlumno);
    mostrarCanvasFinal('alumno', nombreAlumno, 'Materia: Programación Estructurada');
}

function verGraficoActividad(nombreActividad, tema) {
    vistaTablaActividades.style.display = 'none';
    actualizarMigas(3, 'Lecciones', nombreActividad);
    mostrarCanvasFinal('actividad', nombreActividad, `Tema: ${tema}`);
}

// ==========================================
// 6. GRÁFICAS CON LA LIBRERÍA DE CHART.JS
// ==========================================

function mostrarCanvasFinal(tipo, nombreDato, detalleExtra) {
    vistaGraficos.style.display = 'flex'; // Muestra el contenedor del gráfico
    
    //Llena los textos informativos arriba del gráfico
    const elGrupo = document.getElementById('grafico-grupo');
    if(elGrupo) elGrupo.innerText = `Grupo ${grupoSeleccionado}`;
    
    const labelTipo = document.getElementById('label-tipo-dato');
    const spanDato = document.getElementById('grafico-dato-especifico');
    
    // Cambia las etiquetas según lo que se está viendo
    if (tipo === 'alumno') {
        labelTipo.innerText = "Alumno:";
        spanDato.innerText = nombreDato;
    } else if (tipo === 'actividad') {
        labelTipo.innerText = "Actividad:";
        spanDato.innerText = `${nombreDato} - ${detalleExtra}`;
    } else {
        labelTipo.innerText = "Vista:";
        spanDato.innerText = "General del Grupo";
    }

    // Prepara el lienzo o canvas
    const ctx = document.getElementById('miGrafico').getContext('2d');
    
    // IMPORTANTE, Si ya había un gráfico dibujado antes, lo destruye para no encimarlos
    if (graficoActual) graficoActual.destroy();

    //PREPARACIÓN DE DATOS 
    let datosGrafico, etiquetas, colorBarra, labelDataset;
    let textoEjeX, textoEjeY; // Los títulos de los ejes X e Y
    
    // OPCIÓN A: GRÁFICO DE ALUMNO
    if (tipo === 'alumno') {
        // Busca las notas del alumno y si no existen usa las definidas
        const notasRaw = dbSimulada.datosBrutos.notasAlumnos[nombreDato] || dbSimulada.datosBrutos.notasAlumnos['default'];
        
        datosGrafico = notasRaw; // Los datos son las calificaciones tal cual
        // Las etiquetas de abajo son Lec 1, Lec 2, Lec 3...
        etiquetas = notasRaw.map((_, i) => `Lec ${i + 1}`);
        
        colorBarra = '#3E8E41'; // Verde Orión
        labelDataset = 'Calificación';
        textoEjeX = 'Número de Lección';
        textoEjeY = 'Calificación';

    // OPCIÓN B: GRÁFICO DE ACTIVIDAD 
    } else if (tipo === 'actividad') {
        // Obtiene todas las notas revueltas del grupo
        const notasDesordenadas = dbSimulada.datosBrutos.notasActividad;
        
        // Usa la función para contar cuántos alumnos sacaron cada nota
        datosGrafico = calcularFrecuenciaNotas(notasDesordenadas);
        
        etiquetas = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
        colorBarra = '#77ab83'; 
        labelDataset = 'Cantidad de alumnos';
        textoEjeX = 'Calificación';
        textoEjeY = 'Cantidad de alumnos';

    // OPCIÓN C: PROMEDIO DEL GRUPO
    } else { 
        // Obtiene la matriz de todas las notas
        const matriz = dbSimulada.datosBrutos.notasPorLeccionGrupo;
        
        // Calcula el promedio por lección
        datosGrafico = procesarPromediosGrupo(matriz);
        
        etiquetas = matriz.map((_, i) => `Lec ${i + 1}`);
        colorBarra = '#5a6eec';
        labelDataset = 'Promedio';
        textoEjeX = 'Número de Lección';
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
                    beginAtZero: true, // Que empiece en 0
                    // Si es calificación tope en 10 y si es cantidad de alumnos, que crezca sola
                    max: (tipo === 'actividad' ? null : 10), 
                    title: { 
                        display: true,
                        text: textoEjeY, // Pone el título del eje Y
                        font: { weight: 'bold', size: 14 },
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
    vistaListaAlumnos.style.display = 'none';
    vistaTablaActividades.style.display = 'none';
    vistaGraficos.style.display = 'none'; 
    vistaSeleccion.style.display = 'flex';
    actualizarMigas(1);
}

// Botón "Atrás" en la lista de gupos
function regresarAGrupos() {
    vistaSeleccion.style.display = 'none'; // Oculta colores
    vistaGrupos.style.display = 'flex';    // Muestra grupos iniciales

    // Limpia selección
    grupoSeleccionado = '';
    descripcionGrupo = '';

    actualizarMigas(0); 
}

// Botón en las migas para volver del gráfico a la lista anterior
function volverALista(tipo) {
    vistaGraficos.style.display = 'none';
    if(graficoActual) graficoActual.destroy(); // Limpia memoria del gráfico
    
    if (tipo === 'alumno') {
        vistaListaAlumnos.style.display = 'flex';
        actualizarMigas(2, 'Alumnos');
    } else {
        vistaTablaActividades.style.display = 'flex';
        actualizarMigas(2, 'Lecciones');
    }
}

// Atajos para los botones HTML
function regresar() { regresarASeleccion(); }
function irInicio() { location.reload(); } // Recarga la página completa