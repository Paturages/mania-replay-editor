# osu!mania replay editor

[Link to preview](https://paturages.github.io/mania-replay-editor/)

This little dirty ass thing provides 2 main features:
* Replace the beatmap MD5 hash of a replay file by another one: this is particularly
  useful when replay makers made their replays on an unuploaded version of a map,
  or the map got updated in any other way that didn't touch the notes themselves.
* Change the scroll speed of a replay: so this is a little bit experimental because
  the `y` values of the replay file ([see .osr doc](https://osu.ppy.sh/wiki/en/osu!_File_Formats/Osr_(file_format)))
  don't match the scroll speed of the game. Even worse, they're different from map to
  map for reasons unknown! So yeah, trial and error I guess.