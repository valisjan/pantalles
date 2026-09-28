# Pantalles

Aplicació independent per gestionar i mostrar les pantalles informatives de l’IES Josep Sureda i Blanes.

Comparteix el projecte Firebase `quota-e1424` amb Quota i Guàrdies, de manera que les jornades publicades a Guàrdies (`cursos/{curs}/guardiesPublicDays/{data}`) apareixen a Pantalles sense duplicar dades. Fa servir els mateixos tokens visuals, tipografia i estats de cobertura que Guàrdies.

## Estructura

- `src/domain/`: lògica pura i provada (dates i franges, estats de cada cobertura, programació de vistes, enllaços de Drive i Canva).
- `src/services/`: Firebase, sessió i configuració de les pantalles.
- `labs/pantalles/composables/`: rellotge compartit, estat de la pestanya, configuració i jornada publicada.
- `labs/pantalles/components/`: quiosc (`KioskScreen` i peces) i gestió (`AppTopBar`, `ManagementPanel`).
- `labs/pantalles/styles.css`: capes `tokens`, `base`, `kiosk` i `management`.

## Desenvolupament

```bash
npm install
npm run dev
npm run test:domain
npm run test:visual
```

La gestió s’obre amb `/?gestio=1&pantalla=sala-professorat`. El quiosc s’obre amb `/?pantalla=sala-professorat`.

## Desplegament

Netlify desplega automàticament cada canvi a la branca principal. La configuració recomanada és el subdomini `pantalles.iessureda.com`.
