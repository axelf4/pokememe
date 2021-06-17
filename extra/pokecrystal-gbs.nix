{ stdenv, fetchurl, rgbds, python3 }: stdenv.mkDerivation rec {
  pname = "pokecrystal-gbs";
  version = "crystal-20200427";

  src = fetchurl {
    url = "https://gitgud.io/zdxy/pokecrystal-gbs/-/archive/${version}/pokecrystal-gbs-${version}.tar";
    sha256 = "oZXcFK7rcW6q2zLfbtHn+i1olWOXiWZM1mEr/aOeLqg=";
  };

  buildInputs = [ python3 ];

  makeFlags = [ "RGBDS=${rgbds}/bin/" "PYTHON=python3" ];

  installPhase = ''
    mkdir -p $out
    cp crystal{,_sfx}.gbs $out
  '';
}
