# GeoTeaching
Interactive teaching examples


Åbn `index.html` i en browser. Forsiden og de ni øvelser er statiske og bruger relative stier.

## Sidestruktur

Forsiden samler fire emneområder med hver sin oversigt:

- `emner/jordegenskaber.html`: Jords karakterisering og mekaniske egenskaber — deformation, konsolideringsforsøg, konsolidering og forskydningsstyrke.
- `emner/spaendinger.html`: Spændinger i jord — spændinger med dybden og Rankine-jordtryk.
- `emner/grundvand.html`: Grundvandsstrømning — planlagte emner og links til eksisterende øvelser om poretryk og konsolidering.
- `emner/konstruktioner.html`: Geotekniske konstruktioner — fundamenters bæreevne og sætninger samt enkeltpæles bæreevne.

Eksisterende øvelser beholder deres adresser under `eksempler/`. Hver øvelse har brødkrummer til sit primære emneområde; relaterede emner linker til den samme øvelse. Planlagte emner er ikke klikbare øvelser. Advanced Geotechnics ligger fortsat under `advanced/`.

Billederne af jordprøver og havnekonstruktion under `assets/emner/` er fotorealistiske AI-illustrationer, ikke fotos af faktiske prøver eller projekter. Spændingsdiagrammet og strømnettet er SVG-figurer. Prompter og figurforudsætninger findes i `assets/emner/IMAGE-SOURCES.md`.

## Udgivelse med GitHub Pages

Læg `index.html`, `emner/`, `eksempler/`, `advanced/`, `assets/` og `.nojekyll` i roden af GitHub-repositoriet. Vælg **Settings → Pages → Deploy from a branch** og vælg den branch og rodmappe, der indeholder filerne. [GitHubs vejledning til udgivelseskilder](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Kapitelhenvisninger

Hver øvelse henviser til relevante kapitler, afsnit og sider i *Geoteknik*, 3. udgave.

## Kreditering

Undervisningseksemplerne er udviklet af Kenny K. Sørensen. Kontakt: [kks@cae.au.dk](mailto:kks@cae.au.dk).

## Licens og genbrug

© 2026 Kenny K. Sørensen.

- Kildekoden (HTML-markup, CSS og JavaScript) er udgivet under [MIT-licensen](LICENSE). Bevar ophavsrets- og licensteksten ved videredistribution.
- De oprindelige undervisningstekster, øvelser og figurer er udgivet under [Creative Commons Kreditering 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/deed.da). Kreditér Kenny K. Sørensen og GeoTeaching, link til licensen og angiv eventuelle ændringer.
- Aarhus Universitet ejer AU-logoet. Logoet og billederne i `assets/fotos/` er undtaget fra projektets licenser. Genbrug af logoet følger [AU's retningslinjer](https://medarbejdere.au.dk/administration/kommunikation/omdesignet/logo/). Tredjepartsmateriale følger de respektive rettighedshaveres vilkår.
