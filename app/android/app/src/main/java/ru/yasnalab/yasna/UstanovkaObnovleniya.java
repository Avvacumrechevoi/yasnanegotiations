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
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;

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
 *   2. скачанное СВЕРЯЕМ с манифестом версии: размер и sha256. Раньше сверки
 *      не было вовсе — что скачалось по адресу, то и уезжало в установщик.
 *      Установка идёт мимо магазина, поэтому отпечаток — единственное, чем мы
 *      отвечаем за файл до того, как система проверит подпись APK. Не совпало
 *      — файл удаляем и говорим об этом словами, окно установки не открываем;
 *   3. затем показываем системное окно установки с content://-адресом
 *      через FileProvider, который Capacitor уже объявил в манифесте;
 *   4. если у приложения нет права ставить пакеты, сначала ведём человека в
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
    /** Отпечаток из манифеста версии: с ним сверяем скачанное. */
    private String zhdemSha;
    private long zhdemRazmer;

    /**
     * Скачать APK и предложить установку.
     * { url: "https://…/yasna.apk", sha256: "…64 hex…", razmer: 31457280 }
     *
     * Без sha256 и размера не начинаем вовсе: проверить скачанное было бы
     * нечем, а ставить непроверенный пакет мимо магазина нельзя.
     */
    @PluginMethod
    public void skachat(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("нет адреса файла");
            return;
        }

        String sha = call.getString("sha256");
        sha = sha == null ? "" : sha.trim().toLowerCase();
        // Размер читаем через optLong, а НЕ через call.getLong — и это не
        // придирка к стилю. Мост Capacitor переносит объект из JS через JSON,
        // и число 9227701 приходит сюда как Integer. PluginCall.getLong отдаёт
        // значение, только если оно уже Long, а иначе молча возвращает
        // запасное — то есть ноль. Из-за этого проверка ниже срабатывала на
        // совершенно исправном манифесте, и обновление отказывалось начаться
        // словами «нет отпечатка версии». Так вели себя ВСЕ сборки 6.4–7.2:
        // канал обновлений был мёртв с того дня, как появилась сверка.
        // optLong живёт в org.json и приводит к числу и Integer, и Long, и
        // Double, и строку из цифр — что бы мост ни положил.
        long razmer = call.getData().optLong("razmer", 0L);
        if (!sha.matches("[0-9a-f]{64}") || razmer <= 0) {
            call.reject("нет отпечатка версии — проверить скачанное будет нечем");
            return;
        }
        zhdemSha = sha;
        zhdemRazmer = razmer;

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
                    // Сверка идёт по всему файлу — на главном потоке это ANR.
                    proveritIPredlozhit(cel);
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

    /**
     * Сверить скачанное с манифестом и только потом открывать установщик.
     *
     * Сначала размер (дёшево, отсекает обрыв загрузки), потом sha256 всего
     * файла. Не совпало — файл УДАЛЯЕМ: оставленный APK с чужим содержимым
     * человек однажды откроет из папки загрузок сам. Причина расхождения может
     * быть и безобидной (версию перевыложили, пока шла загрузка), но отличить
     * её от подмены нам нечем, поэтому ответ один — не ставим.
     *
     * Считаем в отдельном потоке: onReceive выполняется на главном, а хэш
     * тридцати мегабайт держал бы его секунды — это ANR.
     */
    private void proveritIPredlozhit(File apk) {
        new Thread(() -> {
            JSObject hod = new JSObject();
            hod.put("proveryaem", true);
            notifyListeners("yasnaObnovaHod", hod);

            long dlina = apk.length();
            String svoj = dlina == zhdemRazmer ? otpechatok(apk) : null;
            boolean sovpalo = zhdemSha != null && zhdemSha.equals(svoj);

            JSObject e = new JSObject();
            if (sovpalo) {
                e.put("gotovo", true);
                notifyListeners("yasnaObnovaGotovo", e);
                predlozhitUstanovku(apk);
                return;
            }
            // Причину пишем в журнал, человеку её показывать незачем: ему важно,
            // что файл не тот и установки не будет (текст — в obnovlenie.js).
            android.util.Log.w("YasnaUstanovka", "отпечаток не совпал: ждали "
                    + zhdemSha + " (" + zhdemRazmer + " Б), получили " + svoj + " (" + dlina + " Б)");
            //noinspection ResultOfMethodCallIgnored
            apk.delete();
            e.put("oshibka", "otpechatok");
            notifyListeners("yasnaObnovaGotovo", e);
        }).start();
    }

    /** sha256 файла шестнадцатеричной строкой; null — прочитать не вышло. */
    private static String otpechatok(File f) {
        try (InputStream in = new FileInputStream(f)) {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            byte[] d = md.digest();
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte b : d) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception e) {
            return null;
        }
    }

    private void predlozhitUstanovku(File apk) {
        Context ctx = getContext();
        Uri adres = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
        final Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(adres, "application/vnd.android.package-archive");
        // Без этого флага установщик получает адрес, который ему не разрешено читать.
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        // ОКНО ОТКРЫВАЕМ ИЗ АКТИВНОСТИ, А НЕ ИЗ КОНТЕКСТА ПРИЛОЖЕНИЯ.
        // Раньше здесь стоял ещё и FLAG_ACTIVITY_NEW_TASK — контексту
        // приложения он обязателен, но у него есть цена: новое окно ищет
        // существующую задачу установщика и переиспользует её. Стоило один раз
        // отменить установку, и следующая попытка попадала в ОСТАТОК прошлой
        // задачи (packageinstaller.DeleteStagedFileOnResult), которая
        // закрывалась молча. Со стороны это выглядит как «нажимаю — и ничего»:
        // приложение честно говорит «скачано и проверено», а окна нет.
        // Воспроизведено на стенде: отменить установку, нажать «Скачать» ещё
        // раз — окно не появляется, в журнале result code=2 и
        // onActivityRestartAttempt.
        // Из активности флаг не нужен вовсе: окно ложится поверх приложения,
        // своей задачи не заводит и остатков не наследует.
        final android.app.Activity a = getActivity();
        if (a != null) {
            a.runOnUiThread(() -> a.startActivity(i));
            return;
        }
        // Активности нет (приложение свернули совсем) — тогда по-старому.
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
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
