# Reglas de desarrollo

Estas reglas se aplican a los agentes que trabajen en este repositorio. Las instrucciones específicas del proyecto completan este documento.

1. Resuelve únicamente la tarea solicitada. Elige la solución más sencilla que cumpla los requisitos y encaje con el código existente. No añadas abstracciones, dependencias ni refactorizaciones sin una necesidad demostrada.
2. Antes de editar, comprueba el estado de Git y entiende el comportamiento afectado. Conserva todos los cambios ajenos.
3. Si la solución exige ampliar el alcance o pone en riesgo datos, seguridad o producción, detente y explica las opciones antes de actuar.
4. Prueba lo que cambies. Indica qué comprobaciones pasaron, cuáles fallaron y cuáles no ejecutaste; no confundas pruebas locales con verificación en producción.
5. No hagas commit, push, merge, tag, release ni despliegue sin autorización expresa para cada acción. Nunca descartes trabajo ajeno.
6. Al terminar, explica brevemente qué cambió, por qué, qué queda pendiente y cómo está Git.
7. Mantén limpia la raíz del repositorio. Guarda los archivos y scripts temporales de trabajo en .agent-tmp/, excluido mediante .gitignore. El código, las pruebas y la documentación que deban conservarse van en sus directorios permanentes, no en esa carpeta.
8. Las reglas adicionales de este proyecto se guardan en .agents/. Antes de trabajar, consulta únicamente las que sean aplicables a la tarea. Si no existen reglas adicionales, continúa con este archivo; no presupongas tecnologías ni crees reglas innecesarias.
