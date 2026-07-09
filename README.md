# Triple20

Eine lokale Web-App für Dartturniere. Sie unterstützt Einzelturniere ohne Vereinsbindung und einen optionalen Vereinsmodus mit Saisonwertung. Enthalten sind „Jeder gegen jeden“ mit optionalen Gruppen, Schweizer System, K.-o.-Turnier und Doppel-K.-o.-Turnier, Ergebnisverwaltung, Tabellen, Halbjahres-/Saisonwertung und automatische lokale Speicherung.

## App-Modus

Beim ersten Start fragt Triple20, ob die App für Einzelturniere oder im Vereinsmodus genutzt werden soll. Die Auswahl wird unter `triple20_settings` gespeichert und kann später in den Einstellungen geändert werden.

- Einzelturniere: Turnier, Spieler, Export und Einstellungen.
- Vereinsmodus: Turnier, Saison, Spieler, Statistiken und Einstellungen.

## Saisonwertung

Im Hauptmenü „Saison“ kann eine Halbjahreswertung angelegt werden, z. B. `2026 H1` oder `2026 H2`. Fertige Turniere können anschließend über „In Saisonwertung übernehmen“ gespeichert werden. Die Saisonwertung nutzt das Punktesystem 25/20/15/10/7/5 für 5 bis 0 Siege und unterstützt 0, 2 oder 4 Streichergebnisse. Export als JSON und CSV ist möglich.

## Start

`index.html` direkt im Browser öffnen oder im Ordner einen lokalen Webserver starten.
