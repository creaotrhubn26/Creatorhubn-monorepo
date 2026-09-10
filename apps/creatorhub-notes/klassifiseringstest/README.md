# Klassifiseringstest

Tester den ene antakelsen som kan velte «levende notatflate»: at et system kan
skille mellom en beslutning, et spørsmål, en tvil, en gjengivelse og en
uenighet — og tørre å la være å bygge når det er i tvil.

Ingen generering, ingen skisser, ingen wireframes. Bare: leser modellen deg
riktig, og holder den igjen når den burde?

## Hvorfor dette først

Bommer klassifiseringen, spiller det ingen rolle hvor pen skissen er. Skriver
du «kanskje vi burde ha depositum, men jeg er usikker», og systemet legger til
betaling i hovedflyten, har du fått en jobb du ikke ba om — og du oppdager det
først når du leser resultatet. Da er flyten borte, som var hele poenget.

Testen koster en ettermiddag. Produktet koster måneder.

## Taksonomi

Hvert avsnitt merkes med hva det **er** og hva systemet **burde gjort**.

### Type

| Type | Betyr | Eksempel |
|---|---|---|
| `beslutning` | Avgjort, skal handles på | «Vi skal ha innlogging.» |
| `spørsmål` | Åpent, ingen retning valgt | «Trenger vi egentlig innlogging?» |
| `tvil` | Heller mot noe, men usikker | «Kanskje depositum, men det kan gjøre terskelen for høy.» |
| `gjengivelse` | Refererer andres syn | «Kunden ønsker innlogging.» |
| `uenighet` | Tar avstand fra et standpunkt | «Kunden vil ha det, men jeg er uenig.» |
| `begrensning` | Sier hvordan, ikke hva | «Det må være bestemorvennlig.» |
| `observasjon` | Konstaterer, uten retning | «Jeg ser ikke timelinen.» |
| `meta` | Om arbeidet, ikke innholdet | «Si ifra når det er klart.» |
| `oppgave` | Noe som skal gjøres, av deg eller noen andre | «Vi må få prototypen godkjent før vi kan begynne produksjonen.» |

### Handling

| Handling | Betyr |
|---|---|
| `bygg` | Utvid modellen. Dette er bestemt. |
| `hold` | Noter som mulighet. Ikke rør hovedflyten. |
| `marker_åpent` | Registrer som ubesvart spørsmål. |
| `ingenting` | Gjør ingenting. |

En `oppgave` har alltid handlingen `ingenting`. Den er ikke en beslutning om
hva som skal lages, så modellen skal ikke utvides på den; den noteres fordi
den er nevnt. Svarer modellen `bygg` på en oppgave, teller det som falsk bygg,
og det er riktig — da har den gjort noe med produktet fordi noen skulle ringe
en fotograf.

Venter oppgaven på at noe annet skjer først, skal det stå med. Formatet bærer
det i kortformen, etter en venstrepil — «Starte produksjon ← godkjent
prototype» — ikke i et femte felt. Et femte felt ville tatt fra kortformen
retten til selv å inneholde `|`, som den har i dag. Fasiten holder
avhengigheten i feltet `venter`.

## Målet som avgjør

Ikke treffprosent. Denne:

> **Falsk byggerate** — av avsnittene der fasiten ikke er `bygg`, hvor ofte
> svarer modellen `bygg` likevel?

Det er den ene feilen som ødelegger produktet, fordi den produserer arbeid du
ikke ba om og må oppdage selv. Motsatt feil — at systemet holder igjen når det
kunne bygget — koster deg ingenting. Sideområdet står bare stille et øyeblikk
til.

Terskel: **falsk byggerate under 10 %.** Over det ville jeg ikke bygget videre
uten å endre premisset.

Sekundært: treffer den `type` riktig, og skiller den `tvil` fra `beslutning`?
Det er den vanskeligste grensen, og den viktigste.

## Endringer i fasiten

**10. september 2026:** `oppgave` kom til som type, og fire avsnitt (45–48) ble
lagt til, to av dem med avhengighet. Avsnitt 44, «Husk å spørre Kari om hun har
fått fakturaen», var merket `meta` og er merket om til `oppgave` — det er noe
som skal gjøres, ikke noe om arbeidet. Tallene i `RESULTAT.md` gjelder kjøringen
før dette, på 44 avsnitt uten `oppgave` i taksonomien.

## Kilder til avsnittene

Ekte tekst fra Daniel, ikke konstruerte eksempler:

- Direkte sitater bevart i claude-mem
- Meldinger fra arbeidsøkten der notatappen ble bygget
- Eksempler fra hans eget konseptnotat om levende notatflate

**Kjent begrensning:** mesteparten er skrevet *til en assistent*, ikke *i et
notat*. Registeret er mer instruerende og mindre utforskende enn det produktet
faktisk vil møte. Det gjør testen strengere på beslutninger og svakere på
løsprat. Klarer modellen seg her, er det et nødvendig, ikke tilstrekkelig,
tegn. Neste runde bør bruke notater han har skrevet til seg selv.

## Kjøring

`items.jsonl` holder fasiten. Klassifikatoren får aldri se den — den får kun
`tekst` og taksonomien over, og svarer med `type` og `handling`.
