package com.whereapp.cliente;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;


/** Widget de Whereapp: tres botones que abren la app directo en Pedir moto, Ir a casa o Mi viaje. */
public class WidgetWhereapp extends AppWidgetProvider {
    private static final String PAGINA = "https://nodo-link.github.io/NOX.AI/";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            RemoteViews vista = new RemoteViews(context.getPackageName(), R.layout.widget);
            vista.setOnClickPendingIntent(R.id.boton_pedir, abrir(context, "viaje", 1));
            vista.setOnClickPendingIntent(R.id.boton_casa, abrir(context, "casa", 2));
            vista.setOnClickPendingIntent(R.id.boton_viaje, abrir(context, "carrera", 3));
            vista.setOnClickPendingIntent(R.id.titulo_widget, abrir(context, "inicio", 4));
            manager.updateAppWidget(id, vista);
        }
    }

    private static PendingIntent abrir(Context context, String ruta, int codigo) {
        Intent intent = new Intent(context, Inicio.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(PAGINA + "?ir=" + ruta));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, codigo, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
