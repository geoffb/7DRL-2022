# 📝 TODO

## 🐛 Bugs

- Player can move during intro
- Attacking/interacting with an entity on stairsDown will warp the player (same for pickups underneath monsters)

## Game Loop

- Title
  - Play -> World
- World
  - Start in Wizard Study
    - Intro
      - Only show when unseen
      - Show a series of banner messages:
        - "Thank goodness, you've finally arrived!"
        - "We are in terrible need of your talents."
        - "Our sewer is rather filthy!"
        - "No time to waste!"
    - Exit to first gameplay floor
      - Play game
      - Win -> Won
      - Lose -> Lost
- Lost
  - Restart -> World
- Won
  - Show credits
  - Back to title

## 🍱 Content

- Player
  - New sprite
  - Player abilities? (beyond bump attack/interact)
- Hazards
  - Mold
    - Grow more slowly and/or die more often
    - Different kinds of mold
  - Gas
  - Fire
  - Green Slime
  - Purple Slime
- Containers
  - "pot" - A mix of good and bad
  - "urn?" - Often bad, but rarely really good
- New intro
- Meta?
- Affixes?

## 💫 Polish

- New favicon

## 🧱 Infrastructure

- Minify JavaScript output
- Automatically deploy to GH Pages
- Automatically deploy to itch.io
