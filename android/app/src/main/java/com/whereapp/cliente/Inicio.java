package com.whereapp.cliente;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import java.util.ArrayList;
import java.util.List;

/**
 * Pantalla de arranque: apenas se abre la app pide los permisos de notificaciones y ubicación,
 * y luego abre Whereapp. Si ya los tiene, abre directo.
 */
public class Inicio extends LauncherActivity {
    private static final int PEDIR_PERMISOS = 41;

    private String[] faltan() {
        List<String> lista = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            lista.add(Manifest.permission.POST_NOTIFICATIONS);
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            lista.add(Manifest.permission.ACCESS_FINE_LOCATION);
            lista.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        return lista.toArray(new String[0]);
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        return faltan().length == 0;
    }

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        String[] pedir = faltan();
        if (pedir.length > 0 && Build.VERSION.SDK_INT >= 23) requestPermissions(pedir, PEDIR_PERMISOS);
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permisos, int[] resultados) {
        super.onRequestPermissionsResult(codigo, permisos, resultados);
        // Con o sin permiso, la app se abre (se pueden activar después en Ajustes).
        if (codigo == PEDIR_PERMISOS) launchTwa();
    }
}
