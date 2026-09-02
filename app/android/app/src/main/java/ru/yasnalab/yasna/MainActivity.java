package ru.yasnalab.yasna;

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /* ═══════════════════════════════════════════════════════════════════
       СИСТЕМНЫЕ ПАНЕЛИ РЕШАЮТСЯ ЗДЕСЬ, ОДИН РАЗ И НАДЁЖНО.

       Android 15+ рисует приложение под строкой состояния и жестовой
       полосой (edge-to-edge обязателен для цели 35+). Мы пробовали
       разруливать это на веб-стороне переменными safe-area — и упёрлись
       в две вещи, видимые в логах живого устройства:

         1) инжект переменных в Capacitor гоняется со стартом страницы и
            падает («Error injecting safe area CSS: Cannot read properties
            of null») — значения появляются или нет в зависимости от гонки;
         2) модальные окна веба (например «Какая партия?») прижимают кнопку
            к нижнему краю, а нижние ~30px на Android 15+ — зона системных
            жестов: касание уходит системе, и человек говорит «не нажимается».

       Поэтому: содержимому даётся отступ от панелей ЗДЕСЬ, на уровне окна.
       Инсеты потребляются (CONSUMED) — до веб-слоя они доходят нулями,
       env(safe-area-inset-*) = 0, и все веб-механизмы отступов сами
       превращаются в ничто. Ни гонок, ни зоны жестов поверх кнопок.

       А раз инсеты съедены отступом, то в самих полосах виден фон ОКНА, и
       он обязан совпадать с фоном страницы. Раньше окно красилось здесь
       вручную в один светлый цвет — и это не работало дважды: плагин
       SystemBars Capacitor 8 после onCreate перекрашивал декор в
       windowBackground темы, а темой на рантайме оставалась заставка
       (installSplashScreen никто не звал), то есть тёмно-зелёный знак Ясны
       поверх обеих тем. Теперь цвет живёт в теме (values/values-night), а
       выбор человека внутри приложения доезжает сюда мостом ниже.
       ═══════════════════════════════════════════════════════════════════ */

    /** Тема, о которой сообщила страница: null — ещё не сообщала, идём по системной. */
    private Boolean stranicaTemnaya = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Заставка Android 12 применяется только через installSplashScreen();
        // без вызова окно так и остаётся в теме заставки, postSplashScreenTheme
        // не срабатывает — и всё, что читает windowBackground (в том числе
        // плагин SystemBars), получает цвет заставки вместо фона страницы.
        // Заодно это единственная заставка: вторая, веб-, живёт в glavnaya.html.
        SplashScreen.installSplashScreen(this);

        // Свой плагин обновления регистрируем ДО super.onCreate: мост
        // собирает список плагинов при создании и позже его не пересматривает.
        registerPlugin(UstanovkaObnovleniya.class);
        super.onCreate(savedInstanceState);

        // Мост «тема страницы → панели». Тема выбирается внутри приложения
        // (ключ yasna_theme), а не системной настройкой, поэтому системный
        // ночной режим о ней ничего не знает: без моста человек, включивший
        // тёмную на светлом телефоне, получает светлый козырёк над чёрным
        // экраном. Зовёт мост core/theme.js при каждом применении темы.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new MostTemy(), "YasnaPaneli");
        }

        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        panelyPoTeme();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Плагин SystemBars на смену конфигурации заново красит декор в цвет
        // темы окна — возвращаем цвет той темы, что выбрана в приложении.
        panelyPoTeme();
    }

    /**
     * Красит фон окна за панелями и выставляет светлость значков строки
     * состояния и полосы жестов. Пока страница не сказала своего слова —
     * идём по системному ночному режиму, как и тема окна.
     */
    private void panelyPoTeme() {
        boolean temno = (stranicaTemnaya != null) ? stranicaTemnaya : sistemaTemnaya();
        getWindow().getDecorView().setBackgroundColor(
            ContextCompat.getColor(this, temno ? R.color.fon_stranicy_tma : R.color.fon_stranicy_svet));
        WindowInsetsControllerCompat panely =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        // Значки тёмные только над светлым фоном — иначе тёмное по тёмному.
        panely.setAppearanceLightStatusBars(!temno);
        panely.setAppearanceLightNavigationBars(!temno);
    }

    private boolean sistemaTemnaya() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
            == Configuration.UI_MODE_NIGHT_YES;
    }

    /** Виден странице как window.YasnaPaneli; вызывается не из главного потока. */
    private class MostTemy {

        @JavascriptInterface
        public void tema(final String svet) {
            final boolean temno = "dark".equals(svet);
            runOnUiThread(() -> {
                stranicaTemnaya = temno;
                panelyPoTeme();
            });
        }
    }
}
