# Whereapp para Android (pasajeros) con widget

Esta carpeta crea la APK de pasajeros (`com.whereapp.cliente`) con:
- el **widget** de la pantalla principal (Pedir moto · Ir a casa · Mi viaje),
- los **accesos** al mantener presionado el ícono (Pedir mototaxi · Ir a mi casa),
- las notificaciones de la página como notificaciones de la app.

La APK la compila GitHub solo (pestaña **Actions → Compilar APK de pasajeros**), firmada con la **misma llave** de la APK actual,
para que se instale encima sin desinstalar. La llave nunca se sube al repositorio: va en los *secrets* del repositorio.
