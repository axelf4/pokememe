{ stdenv, rustc, gbsplay }: stdenv.mkDerivation {
  name = "gbs2vgm";

  src = [ ./. ];

  nativeBuildInputs = [ rustc ];

  buildInputs = [ gbsplay ];

  postConfigure = ''
    substituteInPlace gbs2vgm.rs --replace 'gbsplay' '${gbsplay}/bin/gbsplay'
  '';

  buildPhase = ''
    rustc -o $name gbs2vgm.rs
  '';

  installPhase = ''
    mkdir -p $out/bin
    cp $name $out/bin
  '';

  RUST_BACKTRACE = 1;
}
