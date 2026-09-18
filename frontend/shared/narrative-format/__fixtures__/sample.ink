// Eksempel som dekker delsettet.
VAR gold = 0
VAR brave = false
CONST MAX = 3
INCLUDE other.ink

Du våkner i en stille landsby. # scene:village
-> village

=== village ===
~ gold += 10
Du finner en pung med {gold} gull. /* kommentar */
* [Gå til markedet] Du går mot markedet.
    -> market
* {gold >= 10} [Kjøp et sverd] Smeden smiler.
    ~ brave = true
    -> smith
+ [Sov videre]
    Du sover.
- Dagen går. {brave: Du føler deg modig. | Du er fortsatt redd.}
-> village.evening

= evening
Kvelden kommer. {&Månen|Stjernene} lyser.
-> END

=== market ===
Boder i alle farger.
-> DONE

=== smith(x) ===
Smeden nikker.
-> END
