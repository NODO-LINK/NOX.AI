package com.whereapp.cliente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;
import com.google.androidbrowserhelper.trusted.DelegationService;

/**
 * Muestra los avisos de la página como notificaciones de la app.
 * Los importantes (carrera nueva, aceptó, llegó, mensajes, SOS…) suenan con un claxon de moto;
 * los que se actualizan seguido (progreso del viaje), las promociones y los recordatorios usan el sonido normal.
 */
public class ServicioAvisos extends DelegationService {
    private static final String CANAL_CLAXON = "whereapp_claxon_v1";
    private static final String CANAL_NORMAL = "whereapp_avisos_v1";
    private static final String CANAL_SILENCIO = "whereapp_viaje_v1";

    // La ubicación de la página usa el permiso de la app (el que se pide al abrirla).
    public ServicioAvisos() {
        registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
    }

    @Override
    public boolean onNotifyNotificationWithChannel(String etiqueta, int id, Notification aviso, String canal) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null || !nm.areNotificationsEnabled()) return false;
        String t = etiqueta == null ? "" : etiqueta;
        // El aviso del viaje en curso se actualiza a cada rato: va sin sonido.
        boolean silencio = t.contains("whereapp-carrera") && !t.contains("carrera-");
        boolean normal = t.contains("whereapp-promo") || t.contains("whereapp-recordatorio") || t.contains("prueba-aviso");
        String elegido = silencio ? CANAL_SILENCIO : normal ? CANAL_NORMAL : CANAL_CLAXON;
        Uri claxon = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.claxon);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            crearCanales(nm, claxon);
            Notification.Builder b = Notification.Builder.recoverBuilder(this, aviso).setChannelId(elegido);
            if (silencio) comoViaje(b, aviso);
            nm.notify(etiqueta, id, b.build());
        } else if (silencio && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Notification.Builder b = Notification.Builder.recoverBuilder(this, aviso);
            comoViaje(b, aviso);
            nm.notify(etiqueta, id, b.build());
        } else {
            if (!silencio && !normal) {
                aviso.sound = claxon;
                aviso.defaults &= ~Notification.DEFAULT_SOUND;
            }
            nm.notify(etiqueta, id, aviso);
        }
        return true;
    }

    // Viaje en curso: notificación fija con barra de progreso. La página manda el avance al final del texto: "(62%)".
    private static final Pattern AVANCE = Pattern.compile("\\s*\\((\\d{1,3})%\\)\\s*$");
    private void comoViaje(Notification.Builder b, Notification aviso) {
        CharSequence texto = aviso.extras != null ? aviso.extras.getCharSequence(Notification.EXTRA_TEXT) : null;
        if (texto == null) return;
        Matcher m = AVANCE.matcher(texto);
        if (!m.find()) return;
        int avance = Math.max(0, Math.min(100, Integer.parseInt(m.group(1))));
        b.setContentText(texto.subSequence(0, m.start()))
         .setProgress(100, avance, false)
         .setOngoing(avance < 100)
         .setOnlyAlertOnce(true)
         .setSubText(avance + "% del viaje");
    }

    private void crearCanales(NotificationManager nm, Uri claxon) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (nm.getNotificationChannel(CANAL_CLAXON) == null) {
            NotificationChannel c = new NotificationChannel(CANAL_CLAXON, "Avisos importantes (claxon)", NotificationManager.IMPORTANCE_HIGH);
            c.setDescription("Carrera nueva, aceptó, llegó, mensajes y emergencias");
            c.setSound(claxon, new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            c.enableVibration(true);
            c.setVibrationPattern(new long[]{0, 150, 80, 400});
            nm.createNotificationChannel(c);
        }
        if (nm.getNotificationChannel(CANAL_NORMAL) == null) {
            NotificationChannel c = new NotificationChannel(CANAL_NORMAL, "Promociones y recordatorios", NotificationManager.IMPORTANCE_DEFAULT);
            nm.createNotificationChannel(c);
        }
        if (nm.getNotificationChannel(CANAL_SILENCIO) == null) {
            NotificationChannel c = new NotificationChannel(CANAL_SILENCIO, "Viaje en curso", NotificationManager.IMPORTANCE_LOW);
            c.setSound(null, null);
            nm.createNotificationChannel(c);
        }
    }
}
