#!/usr/bin/env bash
# Son commit'i değişiklik günlüğüne kaydeder.
#
# Kullanım:
#   ./docs/degisiklikler/yeni-kayit.sh "kisa-baslik"
#
# Yaptıkları:
#   1) README.md'deki tabloya son commit'in satırını ekler (en üste)
#   2) YYYY-AA-GG-kisa-baslik.md dosyasını şablondan oluşturur
#
# Not: Oluşan .md dosyasını sonra elle doldur (Talep / Yapılanlar / Teknik notlar).

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Kullanım: $0 \"kisa-baslik\"" >&2
  exit 1
fi

SLUG="$1"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$DIR/../.." && pwd)"

HASH="$(git -C "$REPO" log -1 --pretty=format:%h)"
SUBJECT="$(git -C "$REPO" log -1 --pretty=format:%s)"
DATE="$(git -C "$REPO" log -1 --date=format:%Y-%m-%d --pretty=format:%ad)"
FILES="$(git -C "$REPO" show --stat --name-only --pretty=format: HEAD | sed '/^$/d')"

# Şema değişmiş mi?
if echo "$FILES" | grep -q "prisma/schema.prisma"; then SCHEMA="✅"; else SCHEMA="—"; fi

DOC="$DIR/$DATE-$SLUG.md"

if [ -e "$DOC" ]; then
  echo "⚠️  Zaten var: $DOC" >&2
  exit 1
fi

# 1) Detay dosyası
{
  echo "# $DATE — ${SLUG//-/ }"
  echo
  echo "**Commit:** \`$HASH\` · **Şema değişikliği:** $([ "$SCHEMA" = "✅" ] && echo "✅ var" || echo "yok")"
  echo
  echo "## Talep"
  echo "<Kullanıcının kendi ifadesiyle ne istediği>"
  echo
  echo "## Yapılanlar"
  echo "- $SUBJECT"
  echo
  echo "## Teknik notlar"
  echo "<Formül, kural, tuzak — gelecekte hatırlanması gerekenler>"
  echo
  echo "## Etkilenen dosyalar"
  echo "$FILES" | sed 's|^|- `|; s|$|`|'
} > "$DOC"

# 2) README tablosuna satır ekle (Vercel dönemi tablosunun ilk satırı olarak)
ROW="| $DATE | \`$HASH\` | $SUBJECT | $SCHEMA | [↗]($DATE-$SLUG.md) |"
README="$DIR/README.md"
awk -v row="$ROW" '
  !done && /^\|---\|---\|---\|---\|---\|$/ { print; print row; done=1; next }
  { print }
' "$README" > "$README.tmp" && mv "$README.tmp" "$README"

echo "✅ Kayıt oluşturuldu:"
echo "   $DOC"
echo "   README.md tablosuna satır eklendi."
echo
echo "👉 Şimdi $DATE-$SLUG.md içindeki Talep/Teknik notlar bölümlerini doldur."
