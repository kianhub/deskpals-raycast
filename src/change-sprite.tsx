import { ActionPanel, Action, Icon, List, open, closeMainWindow, showToast, Toast } from "@raycast/api";
import { useState, useMemo } from "react";
import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import pokemon from "./pokemon.json";

interface Pokemon {
  name: string;
  gen: number;
}

const allPokemon: Pokemon[] = pokemon;

const customSpritesDir = join(homedir(), "Library", "Application Support", "deskpals", "CustomSprites");

function findAppSpritesDir(): string | null {
  // Check common locations for deskpals.app
  const candidates = [
    "/Applications/deskpals.app/Contents/Resources/Sprites",
    join(homedir(), "Applications", "deskpals.app", "Contents", "Resources", "Sprites"),
  ];
  // Also check Xcode DerivedData for dev builds
  const derivedDataDir = join(homedir(), "Library", "Developer", "Xcode", "DerivedData");
  if (existsSync(derivedDataDir)) {
    try {
      for (const entry of readdirSync(derivedDataDir)) {
        if (entry.startsWith("deskpals-")) {
          candidates.push(
            join(derivedDataDir, entry, "Build", "Products", "Debug", "deskpals.app", "Contents", "Resources", "Sprites"),
          );
        }
      }
    } catch {
      // ignore
    }
  }
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

const appSpritesDir = findAppSpritesDir();

function discoverCustomSprites(): Pokemon[] {
  if (!existsSync(customSpritesDir)) return [];
  try {
    return readdirSync(customSpritesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(customSpritesDir, entry.name, "default_idle_8fps.gif")))
      .map((entry) => ({ name: entry.name.toLowerCase(), gen: -1 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function spriteIcon(p: Pokemon, shiny: boolean): string | undefined {
  if (p.gen === -1) {
    const path = join(customSpritesDir, p.name, "default_idle_8fps.gif");
    return existsSync(path) ? path : undefined;
  }
  if (!appSpritesDir) return undefined;
  const variant = shiny ? "shiny_idle_8fps.gif" : "default_idle_8fps.gif";
  const path = join(appSpritesDir, `gen${p.gen}`, p.name, variant);
  return existsSync(path) ? path : undefined;
}

function genLabel(gen: number): string {
  return gen === -1 ? "Custom" : `Gen ${gen}`;
}

function displayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");
}

export default function Command() {
  const [shiny, setShiny] = useState(false);
  const customSprites = useMemo(() => discoverCustomSprites(), []);

  async function selectSprite(p: Pokemon) {
    const url =
      p.gen === -1
        ? `deskpals://pokemon?name=${encodeURIComponent(p.name)}&gen=-1`
        : `deskpals://pokemon?name=${encodeURIComponent(p.name)}&gen=${p.gen}&shiny=${shiny}`;
    await closeMainWindow();
    await open(url);
    const label = p.gen === -1 ? displayName(p.name) : `${displayName(p.name)}${shiny ? " (Shiny)" : ""}`;
    await showToast({ style: Toast.Style.Success, title: `Selected ${label}` });
  }

  return (
    <List
      searchBarPlaceholder="Search sprites..."
      searchBarAccessory={
        <List.Dropdown tooltip="Shiny" storeValue onChange={(value) => setShiny(value === "true")}>
          <List.Dropdown.Item title="Normal" value="false" icon={Icon.Circle} />
          <List.Dropdown.Item title="Shiny" value="true" icon={Icon.Star} />
        </List.Dropdown>
      }
    >
      {customSprites.length > 0 && (
        <List.Section key="custom" title="Custom">
          {customSprites.map((p) => (
            <List.Item
              key={p.name}
              title={displayName(p.name)}
              subtitle="Custom"
              icon={spriteIcon(p, false) ?? Icon.Brush}
              actions={
                <ActionPanel>
                  <Action title="Select Sprite" icon={Icon.Checkmark} onAction={() => selectSprite(p)} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
      {[1, 2, 3, 4].map((gen) => (
        <List.Section key={gen} title={`Gen ${gen}`}>
          {allPokemon
            .filter((p) => p.gen === gen)
            .map((p) => (
              <List.Item
                key={p.name}
                title={displayName(p.name)}
                subtitle={genLabel(p.gen)}
                icon={spriteIcon(p, shiny)}
                actions={
                  <ActionPanel>
                    <Action title="Select Sprite" icon={Icon.Checkmark} onAction={() => selectSprite(p)} />
                  </ActionPanel>
                }
              />
            ))}
        </List.Section>
      ))}
    </List>
  );
}
