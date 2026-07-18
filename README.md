# Triple20

Eine lokale Web-App für Dartturniere und Vereinswertungen. Enthalten sind „Jeder gegen jeden“ mit optionalen Gruppen, Schweizer System, K.-o.-Turnier und Doppel-K.-o.-Turnier, Ergebnisverwaltung, Tabellen, Halbjahres-/Saisonwertung und automatische lokale Speicherung.

Die App zählt außerdem datensparsam die Zugriffe auf dem jeweiligen Gerät. Pro Browsersitzung wird ein Zugriff erfasst. Nur angemeldete Administratoren sehen unter „Anmelden“ die Auswertung für heute, die aktuelle Woche, den aktuellen Monat und insgesamt. Die Daten werden ausschließlich lokal im Browser gespeichert.

## Struktur

Die Hauptreiter sind bewusst schlank gehalten:

- Turnier
- Saison
- Einstellungen

## Saisonwertung

Im Hauptreiter „Saison“ kann eine Halbjahreswertung angelegt werden, z. B. `2026 H1` oder `2026 H2`. Fertige Turniere können anschließend über „In Saisonwertung übernehmen“ gespeichert werden. Die Saisonwertung nutzt das Punktesystem 25/20/15/10/7/5 für 5 bis 0 Siege und unterstützt Streichergebnisse. Export als JSON und CSV ist möglich.

## Online-Speicherung und Nur-Ansicht

Triple20 speichert weiterhin lokal im Browser und synchronisiert die bestehenden Speicherbereiche zusätzlich mit Supabase, sobald eine angemeldete Turnierleitung als Admin erkannt wurde. Besucher ohne Anmeldung sehen Ranglisten, Spieltage, Ergebnisse und laufende Turniere im Modus „Nur Ansicht“ und können keine Daten ändern.

Unter „Einstellungen“ befindet sich der Bereich „Turnierleitung anmelden“. Dort können Admins sich anmelden, Backups herunterladen, Backups einspielen, Cloud-Daten laden oder lokale Daten bewusst in die Cloud übernehmen.

## Mitgliederkonten

Freigeschaltete Mitglieder können sich ohne Passwort über einen einmaligen E-Mail-Link anmelden und ihren Anzeigenamen sowie einen optionalen Spitznamen pflegen. Jedes Mitglied kann ausschließlich das eigene Profil bearbeiten. Die Turnier- und Saisondaten bleiben für Mitglieder schreibgeschützt; Administratoren verwenden weiterhin die Passwort-Anmeldung der Turnierleitung.

## Mitglieder und Setzliste

Unter „Saison → Mitglieder“ können Vereinsmitglieder gepflegt werden. Beim nächsten Schweizer Turnier werden eingetragene Teilnehmer automatisch nach ihren aktuellen Saison-Siegen gereiht. Diese Reihung wird für die erste Schweizer Runde als Setzliste verwendet.

## Ein- und Ausstieg im Schweizer System

Im laufenden Schweizer Turnier können Spieler nach einer abgeschlossenen Runde aussteigen oder neu einsteigen. Die nächste noch ungespielte Runde wird danach automatisch neu gepaart.

## Spieltage manuell nachtragen

Unter „Saison → Spieltage“ können bereits gespielte Schweizer Turniere über den Button „Spieltag manuell nachtragen“ in die Saisonwertung übernommen werden. Pro Teilnehmer werden Siege, Niederlagen, 180er und höchstes Checkout eingetragen; die Saisonpunkte werden automatisch berechnet.

Die aktuell geladene Saison wird oben kompakt angezeigt. Über „Saison bearbeiten“ kann sie bei Bedarf aufgeklappt und nachträglich geändert werden. Name, Startdatum, Enddatum und Anzahl der Streichergebnisse lassen sich während der Saison ändern.

## Start

`index.html` direkt im Browser öffnen oder im Ordner einen lokalen Webserver starten.
