{ pkgs ? import <nixpkgs> {} }: rec {
  gbsplay = pkgs.callPackage ./gbsplay.nix {};

  gbs2vgm = pkgs.callPackage ./gbs2vgm.nix { inherit gbsplay; };
}
