// Prelude del frente «clima, atmósfera, iluminación y ciclo día/noche»: clima por GPU, fondo degradado, cono de linterna, suelo mojado.
// Alias con prefijo Cl para no chocar con los de otros frentes ni con los identificadores minificados del juego.
import { WeatherFx as ClWeather, GroundMist as ClMist, FlashCone as ClCone, installWetness as ClWet } from '@engine/weather.js';
import { SkyBackdrop as ClSky, dayState as ClDay, lookForTheme as ClThemeLook, THEME_WEATHER as ClThemeWx } from '@engine/atmosphere.js';
