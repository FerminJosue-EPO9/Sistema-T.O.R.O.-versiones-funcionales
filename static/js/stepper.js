let currentStep = 1;
let selectedTemplate = null; // 'camino', 'cuestionario', 'palabra'
let selectedQuestionType = null; // 'verdadero', 'multiple' (solo para cuestionario)
let activityConfig = {
    content: "", // Para guardar el texto o pasos
    timeLimit: 60,
    attempts: 3
};

const steps = document.querySelectorAll(".step");
const content = document.getElementById("content");
const progress = document.getElementById("progress");

function updateStepper() {
    steps.forEach((step, i) => {
        if (i < currentStep) {
            step.classList.add("active");
        } else {
            step.classList.remove("active");
        }
    });
    // Ajuste visual de la barra de progreso
    let progressPercentage = ((currentStep - 1) / 3) * 100;
    progress.style.width = progressPercentage + "%";
}

function selectCard(type, value, element) {
    // Remover selección previa en el mismo grupo de tarjetas
    let siblings = element.parentElement.querySelectorAll(".card");
    siblings.forEach(c => c.classList.remove("selected"));
    
    element.classList.add("selected");

    if (type === "template") {
        selectedTemplate = value;
        // Reiniciar subtipo si se cambia la plantilla principal
        selectedQuestionType = null; 
    }
    if (type === "question") {
        selectedQuestionType = value;
    }
}

// Función auxiliar para guardar inputs de texto (pasos 2 y 3)
function handleInputChange(key, value) {
    activityConfig[key] = value;
}

function renderContent() {
    content.innerHTML = ""; // Limpiar contenido

    // --- PASO 1: SELECCIÓN DE PLANTILLA ---
    if (currentStep === 1) {
        content.innerHTML = `
        <h2 class="step-title">Selecciona la plantilla</h2>
        <div class="cards">
            <div class="card ${selectedTemplate === 'camino' ? 'selected' : ''}"
                style="background-image:linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('https://picsum.photos/400/200?1')"
                onclick="selectCard('template','camino', this)">
                <span>Completar camino</span>
            </div>

            <div class="card ${selectedTemplate === 'cuestionario' ? 'selected' : ''}"
                style="background-image:linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('https://picsum.photos/400/200?2')"
                onclick="selectCard('template','cuestionario', this)">
                <span>Cuestionario</span>
            </div>

            <div class="card ${selectedTemplate === 'palabra' ? 'selected' : ''}"
                style="background-image:linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('https://picsum.photos/400/200?3')"
                onclick="selectCard('template','palabra', this)">
                <span>Completar palabra</span>
            </div>
        </div>`;
    }

    // --- PASO 2: CONFIGURACIÓN ESPECÍFICA ---
    if (currentStep === 2) {
        let html = "";
        
        if (selectedTemplate === "cuestionario") {
            html = `
            <h2 class="step-title">Tipo de cuestionario</h2>
            <div class="cards">
                <div class="card ${selectedQuestionType === 'verdadero' ? 'selected' : ''}"
                    style="background-image:linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('https://picsum.photos/400/200?4')"
                    onclick="selectCard('question','verdadero', this)">
                    <span>Verdadero / Falso</span>
                </div>

                <div class="card ${selectedQuestionType === 'multiple' ? 'selected' : ''}"
                    style="background-image:linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('https://picsum.photos/400/200?5')"
                    onclick="selectCard('question','multiple', this)">
                    <span>Opción múltiple</span>
                </div>
            </div>`;
        } else if (selectedTemplate === "palabra") {
            html = `
            <h2 class="step-title">Configurar frase</h2>
            <div class="config-form">
                <div class="form-group">
                    <label>Escribe la frase completa:</label>
                    <textarea rows="4" onchange="handleInputChange('content', this.value)">${activityConfig.content}</textarea>
                    <small>El sistema ocultará palabras automáticamente.</small>
                </div>
            </div>`;
        } else if (selectedTemplate === "camino") {
            html = `
            <h2 class="step-title">Configurar secuencia</h2>
            <div class="config-form">
                <div class="form-group">
                    <label>Define los pasos del camino (separados por comas):</label>
                    <input type="text" placeholder="Inicio, Bosque, Castillo, Meta" 
                           value="${activityConfig.content}" 
                           onchange="handleInputChange('content', this.value)">
                </div>
            </div>`;
        }

        content.innerHTML = html;
    }

    // --- PASO 3: MÉTRICAS GENERALES ---
    if (currentStep === 3) {
        content.innerHTML = `
        <h2 class="step-title">Configuración de métricas</h2>
        <div class="config-form">
            <div class="form-group">
                <label>Tiempo límite (segundos):</label>
                <input type="number" value="${activityConfig.timeLimit}" min="10" 
                       onchange="handleInputChange('timeLimit', this.value)">
            </div>
            <div class="form-group">
                <label>Intentos permitidos:</label>
                <input type="number" value="${activityConfig.attempts}" min="1" max="10"
                       onchange="handleInputChange('attempts', this.value)">
            </div>
        </div>
        `;
    }

    // --- PASO 4: FINALIZACIÓN ---
    if (currentStep === 4) {
        // Generar resumen
        let summaryType = selectedTemplate.toUpperCase();
        if(selectedQuestionType) summaryType += ` (${selectedQuestionType})`;

        content.innerHTML = `
        <h2 class="step-title">¡Actividad lista!</h2>
        <div style="text-align:center; padding: 20px;">
            <div style="font-size: 50px; color: #4CAF50;">✓</div>
            <p>Se ha creado la actividad de tipo: <strong>${summaryType}</strong></p>
            <ul style="list-style:none; padding:0; margin-top:10px;">
                <li>Tiempo: ${activityConfig.timeLimit}s</li>
                <li>Intentos: ${activityConfig.attempts}</li>
            </ul>
            <button onclick="alert('Guardado en base de datos')" style="padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">Publicar Actividad</button>
        </div>
        `;
    }
}

function nextStep() {
    // Validaciones antes de avanzar
    if (currentStep === 1) {
        if (!selectedTemplate) {
            alert("Por favor selecciona una plantilla.");
            return;
        }
    }

    if (currentStep === 2) {
        if (selectedTemplate === "cuestionario" && !selectedQuestionType) {
            alert("Por favor selecciona un tipo de cuestionario.");
            return;
        }
        // Validación básica para palabra y camino
        if ((selectedTemplate === "palabra" || selectedTemplate === "camino") && activityConfig.content === "") {
             alert("Por favor rellena la información de la actividad.");
             return; // Opcional: quitar si quieres permitir vacío
        }
    }

    if (currentStep < 4) {
        currentStep++;
        updateStepper();
        renderContent();
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepper();
        renderContent();
    }
}

// Inicializar
renderContent();
updateStepper();