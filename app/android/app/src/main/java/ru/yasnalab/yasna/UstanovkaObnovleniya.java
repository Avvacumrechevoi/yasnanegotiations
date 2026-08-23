package ru.yasnalab.yasna;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Установка обновления приложения, минуя магазин.
 *
 * ЗАЧЕМ НАТИВНЫЙ КОД. Раньше «Скачать» звал window.open(url, '_system') —
 * приём Cordova, которого в Capacitor нет вовсе. WebView отдавал адрес APK
 * системе «кому-нибудь», и на телефонах Samsung его перехватывал Galaxy
 * Store: человек видел, как магазин пытается скачать чужое приложение.
 *
 * Здесь путь явный и целиком наш:
 *   1. DownloadManager кладёт APK в приватную папку приложения — разрешения
 *      на внешнюю память для этого не нужны;
 *   2. по завершении показываем системное окно установки с content://-адресом
 *      через FileProvider, который Capacitor уже объявил в манифесте;
 *   3. если у приложения нет права ставить пакеты, сначала ведём человека в
 *      системную настройку — иначе установщик молча не открылся бы.
 *
 * Прогресс отдаём событиями 'yasnaObnovaHod' и 'yasnaObnovaGotovo', чтобы
 * кнопка в Профиле показывала проценты, а не замирала.
 */
@CapacitorPlugin(name = "YasnaUstanovka")
public class UstanovkaObnovleniya extends Plugin {

    private static final String PAPKA = Environment.DIRECTORY_DOWNLOADS;
    private static final String IMYA = "yasna-obnovlenie.apk";

    private BroadcastReceiver priyomnik;
    private long zadanie = -1;

    /** Скачать APK и предложить установку. { url: "https://…/yasna.apk" } */
    @PluginMethod
    public void skachat(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("нет адреса файла");
            return;
        }

        Context ctx = getContext();
        File cel = new File(ctx.getExternalFilesDir(PAPKA), IMYA);
        // Остаток прошлой попытки: DownloadManager не перезаписывает файл,
        // а создаёт yasna-obnovlenie-1.apk — и установщик получал бы старое.
        if (cel.exists() && !cel.delete()) {
            call.reject("не удалось убрать прошлую загрузку");
            return;
        }

        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) {
            call.reject("загрузчик недоступен");
            return;
        }

        DownloadManager.Request z = new DownloadManager.Request(Uri.parse(url));
        z.setTitle("Ясна — обновление");
        z.setDescription("Скачиваю новую версию");
        z.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
        z.setDestinationInExternalFilesDir(ctx, PAPKA, IMYA);
        z.setMimeType("application/vnd.android.package-archive");

        snyatPriyomnik();
        priyomnik = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) {
                long id = i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != zadanie) return;
                snyatPriyomnik();
                if (uspeshno(dm, id)) {
                    JSObject e = new JSObject();
                    e.put("gotovo", true);
                    notifyListeners("yasnaObnovaGotovo", e);
                    predlozhitUstanovku(cel);
                } else {
                    JSObject e = new JSObject();
                    e.put("oshibka", "загрузка не удалась");
                    notifyListeners("yasnaObnovaGotovo", e);
                }
            }
        };
        IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ctx.registerReceiver(priyomnik, f, Context.RECEIVER_EXPORTED);
        } else {
            ctx.registerReceiver(priyomnik, f);
        }

        zadanie = dm.enqueue(z);
        sledit(dm);

        JSObject ok = new JSObject();
        ok.put("nachato", true);
        call.resolve(ok);
    }

    /** Есть ли у приложения право ставить пакеты (Android 8+). */
    @PluginMethod
    public void mozhetStavit(PluginCall call) {
        JSObject r = new JSObject();
        r.put("mozhet", Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    /** Открыть системную настройку «Установка неизвестных приложений». */
    @PluginMethod
    public void otkrytNastrojku(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    // ─── внутреннее ──────────────────────────────────────────────────

    private boolean uspeshno(DownloadManager dm, long id) {
        DownloadManager.Query q = new DownloadManager.Query().setFilterById(id);
        try (Cursor c = dm.query(q)) {
            if (c != null && c.moveToFirst()) {
                int st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                return st == DownloadManager.STATUS_SUCCESSFUL;
            }
        } catch (Exception ignored) {}
        return false;
    }

    /**
     * Проценты — раз в полсекунды, пока задание живо.
     *
     * Отдельно различаем «ждёт» (STATUS_PENDING / STATUS_PAUSED): без годного
     * интернета системный загрузчик держит задание в очереди сколько угодно
     * долго и НИЧЕГО не сообщает. Проверено на стенде без сети: строка так и
     * стояла бы «Скачиваю…». Через ЖДЁМ_ПРЕДЕЛ говорим прямо, что ждём сеть.
     */
    private static final int ZHDEM_PREDEL = 20000;   /* мс молчаливого ожидания */

    private void sledit(DownloadManager dm) {
        new Thread(() -> {
            boolean idyot = true;
            long zhdem = 0;
            boolean skazali = false;
            while (idyot) {
                DownloadManager.Query q = new DownloadManager.Query().setFilterById(zadanie);
                try (Cursor c = dm.query(q)) {
                    if (c == null || !c.moveToFirst()) break;
                    int st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    long est = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                    long vsego = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));

                    JSObject e = new JSObject();
                    if (st == DownloadManager.STATUS_PENDING || st == DownloadManager.STATUS_PAUSED) {
                        zhdem += 500;
                        if (zhdem >= ZHDEM_PREDEL && !skazali) {
                            skazali = true;
                            e.put("zhdyot", true);
                            notifyListeners("yasnaObnovaHod", e);
                        }
                    } else {
                        zhdem = 0;
                        skazali = false;
                        if (vsego > 0) {
                            e.put("procent", (int) (est * 100 / vsego));
                            notifyListeners("yasnaObnovaHod", e);
                        }
                    }
                    idyot = st == DownloadManager.STATUS_RUNNING || st == DownloadManager.STATUS_PENDING
                            || st == DownloadManager.STATUS_PAUSED;
                } catch (Exception e) {
                    break;
                }
                try { Thread.sleep(500); } catch (InterruptedException e) { break; }
            }
        }).start();
    }

    /** Снять текущую загрузку — например, когда человек не стал ждать сеть. */
    @PluginMethod
    public void otmenit(PluginCall call) {
        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm != null && zadanie > 0) dm.remove(zadanie);
        snyatPriyomnik();
        zadanie = -1;
        call.resolve();
    }

    private void predlozhitUstanovku(File apk) {
        Context ctx = getContext();
        Uri adres = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(adres, "application/vnd.android.package-archive");
        // Без этого флага установщик получает адрес, который ему не разрешено читать.
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
    }

    private void snyatPriyomnik() {
        if (priyomnik == null) return;
        try { getContext().unregisterReceiver(priyomnik); } catch (Exception ignored) {}
        priyomnik = null;
    }

    @Override
    protected void handleOnDestroy() {
        snyatPriyomnik();
    }
}
