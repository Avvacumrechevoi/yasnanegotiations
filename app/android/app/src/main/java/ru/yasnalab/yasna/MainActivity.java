package ru.yasnalab.yasna;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

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
       ═══════════════════════════════════════════════════════════════════ */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Свой плагин обновления регистрируем ДО super.onCreate: мост
        // собирает список плагинов при создании и позже его не пересматривает.
        registerPlugin(UstanovkaObnovleniya.class);
        super.onCreate(savedInstanceState);

        // За панелями — цвет фона страниц, а не чёрный: строка состояния
        // выглядит частью приложения.
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#f5f6f8"));
        // Значки строки состояния тёмные: фон под ними светлый.
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView())
            .setAppearanceLightStatusBars(true);

        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
