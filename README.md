# Kung Fu Panda — Légendes du Combat

Jeu web de combat 1v1 dans l'univers de Kung Fu Panda. Le joueur affronte des bots (3 niveaux de difficulté). 100 % HTML/CSS/JavaScript, sans dépendance.

## Lancer le jeu

Ouvrir simplement `index.html` dans un navigateur (double-clic suffit), ou servir le dossier :

```bash
cd kung-fu-panda-fighter
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Personnages (10)

Po, Tigresse, Singe, Mante, Vipère, Grue, Taï Lung, Lord Shen, Kaï, Maître Shifu — chacun avec ses stats (vie, vitesse, puissance, taille), son style et son coup spécial unique :

- **Charge** (Po, Tigresse, Taï Lung) : dash percutant
- **Rush multi-coups** (Singe, Mante) : enchaînement d'attaques
- **Projectile** (Vipère, Grue, Shen, Kaï, Shifu) : attaque à distance

## Contrôles

| Action | Touche |
|---|---|
| Déplacement | ← / → (ou Q / D) |
| Saut | ↑, Espace ou Z |
| Garde | ↓ ou S |
| Poing | A ou J |
| Pied | E ou K |
| Spécial (jauge pleine) | W ou L |

## Règles

- Match en 2 manches gagnantes, 60 s par manche.
- La jauge d'énergie se remplit en donnant et encaissant des coups ; à 100 %, lance le coup spécial.
- La garde réduit les dégâts à 20 %.
- 4 arènes aléatoires : Palais de Jade, Pont de Corde, Vallée de la Paix, Prison de Chorh-Gom.
