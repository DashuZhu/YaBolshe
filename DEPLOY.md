# Размещение портала на сервере

Рекомендуемая конфигурация для старта: Ubuntu 24.04, 2 vCPU, 4 ГБ RAM, SSD от 50 ГБ. GPU не требуется: Whisper вызывается через OpenAI API.

## 1. Сервер и домен

Можно купить облачный сервер и домен в одной панели Timeweb Cloud/Timeweb. Для домена создайте A-запись со значением публичного IP сервера. Откройте входящие порты 22, 80 и 443.

## 2. Подготовка Ubuntu

```bash
ssh root@IP_СЕРВЕРА
apt update && apt install -y git ca-certificates curl
curl -fsSL https://get.docker.com | sh
```

## 3. Код и настройки

```bash
git clone https://github.com/DashuZhu/YaBolshe.git yabolshe
cd yabolshe
cp .env.example .env
nano .env
```

В `.env` укажите домен без `https://`, ключ OpenAI и четыре разных сложных секрета. Сгенерировать секрет можно командой `openssl rand -hex 32`. Файл `.env` нельзя отправлять в чат или GitHub.

## 4. Запуск

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
```

После обновления DNS откройте `https://ваш-домен.ru`. Caddy автоматически получит и будет продлевать бесплатный HTTPS-сертификат.

## 5. Обновление портала

```bash
cd ~/yabolshe
git pull --ff-only
docker compose up -d --build
```

## Данные и безопасность

- Аудио хранится в закрытом Docker-томе и не попадает в GitHub.
- База также хранится в отдельном томе и сохраняется при перезапуске.
- До работы с реальными сессиями настройте ежедневные резервные копии в отдельное защищённое хранилище.
- Поскольку это чувствительные данные клиентов, нужны информированное согласие на обработку/передачу аудио и проверка требований к персональным данным для вашей юрисдикции.

Полезные команды:

```bash
docker compose logs -f app
docker compose restart app
docker compose down
```
