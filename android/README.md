# Whereapp para Android (pasajeros) con widget

Esta carpeta crea las APK de pasajeros (`com.whereapp.cliente`) y de motorizados (`com.whereapp.moto`). Pasajeros trae:
- el **widget** de la pantalla principal (Pedir moto · Ir a casa · Mi viaje),
- los **accesos** al mantener presionado el ícono (Pedir mototaxi · Ir a mi casa),
- las notificaciones de la página como notificaciones de la app.

La APK la compila GitHub solo (pestaña **Actions → Compilar APK de pasajeros**), firmada con la **misma llave** de la APK actual,
para que se instale encima sin desinstalar. La llave nunca se sube al repositorio: va en los *secrets* del repositorio.

Las dos suenan con un **claxon de moto** en los avisos importantes (carrera nueva, aceptó, llegó, mensajes, SOS).
