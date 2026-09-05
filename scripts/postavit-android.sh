#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Восстановление инструментария сборки приложения: JDK 21, Android SDK
# и стенд-эмулятор.
#
# ЗАЧЕМ СКРИПТ. 05.09.2026 с машины исчез весь каталог ~/.local/android-build
# — обе JDK и Android SDK целиком, несколько гигабайт. Восстанавливать
# пришлось по памяти и по обрывкам README, и это съело полсессии. Инструкция
# в app/README.md описывала ПУТИ, но не то, как всё это поставить заново.
# Теперь порядок восстановления лежит в репозитории и переживает любую чистку.
#
# ЧТО СТАВИТ:
#   • JDK 21 (Temurin, macOS aarch64) — ИМЕННО 21: Capacitor 8 под 17 отвечает
#     «invalid source release: 21»;
#   • Android SDK: cmdline-tools, platform-tools, platforms;android-36
#     (compileSdk=36 в variables.gradle), build-tools;35.0.0;
#   • эмулятор и образ android-35 arm64 + стенд `yasna-test`.
#
# ИСПОЛЬЗОВАНИЕ:
#   ./scripts/postavit-android.sh            # всё, чего не хватает
#   ./scripts/postavit-android.sh --bez-stenda   # без эмулятора и образа
#
# Скрипт ИДЕМПОТЕНТЕН: что уже стоит — не трогает. Можно звать повторно
# после любой чистки.
#
# ИМЕНА ПЕРЕМЕННЫХ ЗДЕСЬ ЛАТИНСКИЕ, и это не вкусовщина: штатный bash на macOS
# — 3.2, кириллические идентификаторы он не понимает, причём падает не на
# объявлении, а на первом же массиве («syntax error near unexpected token»).
# Те же грабли уже ловились на scripts приёмки. Комментарии и вывод — русские.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$HOME/.local/android-build"
JDK="$ROOT/jdk-21"
SDK="$ROOT/sdk"
STEND="${STEND:-yasna-test}"
IMAGE="system-images;android-35;google_apis;arm64-v8a"
NO_STEND=0
[ "${1:-}" = "--bez-stenda" ] && NO_STEND=1

mkdir -p "$ROOT"

# ─── JDK 21 ────────────────────────────────────────────────────────
if [ -x "$JDK/Contents/Home/bin/javac" ]; then
  echo "✓ JDK 21 на месте"
else
  echo "→ качаю JDK 21 (Temurin, aarch64)…"
  URL="https://api.adoptium.net/v3/binary/latest/21/ga/mac/aarch64/jdk/hotspot/normal/eclipse"
  curl -fsSL "$URL" -o /tmp/jdk21.tar.gz
  rm -rf /tmp/jdk21 && mkdir -p /tmp/jdk21
  tar -xzf /tmp/jdk21.tar.gz -C /tmp/jdk21
  # -mindepth 1 обязателен: без него шаблон '*jdk*' совпадает с самой
  # /tmp/jdk21, и наверх уезжает временная папка, а настоящий каталог JDK
  # остаётся вложенным. Проверено на себе: java оказывалась на этаж ниже,
  # а sdkmanager потом молча не ставил ни одного пакета.
  INNER="$(find /tmp/jdk21 -mindepth 1 -maxdepth 1 -type d -name 'jdk-*' | head -1)"
  [ -n "$INNER" ] || { echo "✗ в архиве не нашлось каталога jdk-*" >&2; exit 1; }
  rm -rf "$JDK" && mv "$INNER" "$JDK"
  rm -rf /tmp/jdk21 /tmp/jdk21.tar.gz
  # Проверяем сразу: сломанная раскладка обнаруживается здесь, а не через
  # десять минут на непонятной ошибке сборки.
  [ -x "$JDK/Contents/Home/bin/java" ] || {
    echo "✗ java не нашлась в $JDK/Contents/Home/bin — раскладка архива другая" >&2; exit 1; }
  echo "✓ JDK 21: $("$JDK/Contents/Home/bin/java" -version 2>&1 | head -1)"
fi

export JAVA_HOME="$JDK/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"

# ─── Android SDK: cmdline-tools ────────────────────────────────────
SDKMAN="$SDK/cmdline-tools/latest/bin/sdkmanager"
if [ -x "$SDKMAN" ]; then
  echo "✓ cmdline-tools на месте"
else
  echo "→ качаю Android command-line tools…"
  mkdir -p "$SDK/cmdline-tools"
  curl -fsSL "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip" \
    -o /tmp/cmdline-tools.zip
  rm -rf /tmp/cmdline-tools && mkdir -p /tmp/cmdline-tools
  unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools
  rm -rf "$SDK/cmdline-tools/latest"
  mv /tmp/cmdline-tools/cmdline-tools "$SDK/cmdline-tools/latest"
  rm -f /tmp/cmdline-tools.zip
  echo "✓ cmdline-tools поставлены"
fi

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"

# ─── Пакеты SDK ────────────────────────────────────────────────────
# Лицензии принимаем отдельным шагом: без них sdkmanager молча ничего не
# ставит, а сообщение об этом тонет в его же выводе.
echo "→ принимаю лицензии…"
yes 2>/dev/null | "$SDKMAN" --sdk_root="$SDK" --licenses >/dev/null || true

PKGS=("platform-tools" "platforms;android-36" "build-tools;35.0.0")
if [ "$NO_STEND" = "0" ]; then
  PKGS+=("emulator" "$IMAGE")
fi
echo "→ ставлю: ${PKGS[*]}"
"$SDKMAN" --sdk_root="$SDK" "${PKGS[@]}" >/dev/null
echo "✓ пакеты SDK на месте"

# ─── Стенд ─────────────────────────────────────────────────────────
# Размер экрана тот же, что был у прежнего стенда: 412×843 dp при dpr 2.625,
# то есть 1080×2400 точек. Замеры прокрутки и снимки сверяются с этими
# числами, и другой размер сделал бы прошлые проверки несравнимыми.
if [ "$NO_STEND" = "0" ]; then
  AVDMAN="$SDK/cmdline-tools/latest/bin/avdmanager"
  if "$AVDMAN" list avd 2>/dev/null | grep -q "Name: $STEND"; then
    echo "✓ стенд $STEND на месте"
  else
    echo "→ завожу стенд $STEND…"
    echo no | "$AVDMAN" create avd -n "$STEND" -k "$IMAGE" --force >/dev/null
    CONF="$HOME/.android/avd/$STEND.avd/config.ini"
    if [ -f "$CONF" ]; then
      {
        echo "hw.lcd.width=1080"
        echo "hw.lcd.height=2400"
        echo "hw.lcd.density=420"
        echo "hw.keyboard=yes"
        echo "hw.ramSize=2048"
      } >> "$CONF"
    fi
    echo "✓ стенд заведён"
  fi
fi

cat <<KONEC

Готово. Окружение для сборки:

  export PATH="\$HOME/.local/node22/bin:\$PATH"
  export JAVA_HOME="$JDK/Contents/Home"
  export ANDROID_HOME="$SDK"
  export PATH="\$JAVA_HOME/bin:\$ANDROID_HOME/platform-tools:\$PATH"

Сборка APK:   cd app && npm run apk
Запуск стенда: \$ANDROID_HOME/emulator/emulator -avd $STEND -no-window -no-audio -no-boot-anim -no-snapshot -gpu angle_indirect -port 5556
KONEC
