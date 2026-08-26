#!/usr/bin/env bash
# Wrap an artifact source file in a real HTML document so it can be shared as
# a file (Asana attachment, email, file share) instead of only as a link.
#
# The artifact source deliberately has no <!doctype>/<html>/<head>/<body> —
# the publisher injects them. Opened straight from disk it would fall into
# quirks mode and the layout shifts, so derive a wrapped copy instead.
#
#   ./make-standalone.sh page.html                 -> page-standalone.html
#   ./make-standalone.sh page.html out.html        -> out.html
#
# Never write the wrapper into the source file itself: publishing a file that
# already has the skeleton produces nested <html>/<body> and breaks the page.

set -euo pipefail

src="${1:?usage: make-standalone.sh <source.html> [output.html]}"
[ -f "$src" ] || { echo "no such file: $src" >&2; exit 1; }
out="${2:-${src%.html}-standalone.html}"

awk '
  BEGIN {
    print "<!doctype html>"
    print "<html lang=\"en\">"
    print "<head>"
    print "<meta charset=\"utf-8\">"
    print "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
    split_done = 0
  }
  # First top-level content element ends the head. Covers the usual shapes;
  # extend the pattern if a page opens with something else.
  # NB: no \b here — POSIX awk reads \b as backspace, not a word boundary.
  !split_done && /^[[:space:]]*<(div|header|main|section|article|nav|figure|h1)[ >]/ {
    print "</head>"
    print "<body>"
    split_done = 1
  }
  { print }
  END {
    if (!split_done) {
      # No recognisable container: the file was head-only. Emit the boundary so
      # the document is at least well formed, and warn on stderr.
      print "</head>"
      print "<body>"
      print "<!-- make-standalone.sh: no top-level container matched -->"
      printf "make-standalone.sh: warning - no top-level container matched; check %s\n", ARGV[1] > "/dev/stderr"
    }
    print "</body>"
    print "</html>"
  }
' "$src" > "$out"

printf 'wrote %s (%s bytes)\n' "$out" "$(wc -c < "$out" | tr -d ' ')"

# Sanity: exactly one of each skeleton tag.
for tag in '<!doctype html>' '<html lang="en">' '</head>' '<body>' '</body>' '</html>'; do
  n=$(grep -Fc -- "$tag" "$out" || true)
  [ "$n" = "1" ] || echo "  warning: found $n occurrences of '$tag' (expected 1)" >&2
done
