# Triple20

Eine lokale Web-App für Dartturniere und Vereinswertungen. Enthalten sind „Jeder gegen jeden“ mit optionalen Gruppen, Schweizer System, K.-o.-Turnier und Doppel-K.-o.-Turnier, Ergebnisverwaltung, Tabellen, Halbjahres-/Saisonwertung und automatische lokale Speicherung.

## Struktur

Die Hauptreiter sind bewusst schlank gehalten:

- Turnier
- Saison
- Einstellungen

## Saisonwertung

Im Hauptreiter „Saison“ kann eine Halbjahreswertung angelegt werden, z. B. `2026 H1` oder `2026 H2`. Fertige Turniere können anschließend über „In Saisonwertung übernehmen“ gespeichert werden. Die Saisonwertung nutzt das Punktesystem 25/20/15/10/7/5 für 5 bis 0 Siege und unterstützt Streichergebnisse. Export als JSON und CSV ist möglich.

## Mitglieder und Setzliste

Unter „Saison → Mitglieder“ können Vereinsmitglieder gepflegt werden. Beim nächsten Schweizer Turnier werden eingetragene Teilnehmer automatisch nach ihren aktuellen Saison-Siegen gereiht. Diese Reihung wird für die erste Schweizer Runde als Setzliste verwendet.

## Ein- und Ausstieg im Schweizer System

Im laufenden Schweizer Turnier können Spieler nach einer abgeschlossenen Runde aussteigen oder neu einsteigen. Die nächste noch ungespielte Runde wird danach automatisch neu gepaart.

## Spieltage manuell nachtragen

Unter „Saison → Spieltage“ können bereits gespielte Schweizer Turniere über den Button „Spieltag manuell nachtragen“ in die Saisonwertung übernommen werden. Pro Teilnehmer werden Siege, Niederlagen, 180er und höchstes Checkout eingetragen; die Saisonpunkte werden automatisch berechnet.

Die aktuell geladene Saison wird oben kompakt angezeigt. Über „Saison bearbeiten“ kann sie bei Bedarf aufgeklappt und nachträglich geändert werden. Name, Startdatum, Enddatum und Anzahl der Streichergebnisse lassen sich während der Saison ändern.

## Start

`index.html` direkt im Browser öffnen oder im Ordner einen lokalen Webserver starten.
