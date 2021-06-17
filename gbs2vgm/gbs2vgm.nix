{ stdenv, luajit, gbsplay }: stdenv.mkDerivation {
  name = "gbs2vgm";

  src = [ ./. ];

  buildInputs = [
    gbsplay
    (luajit.withPackages (ps: with ps; [ argparse binaryheap ]))
  ];

  postConfigure = ''
    substituteInPlace gbs2vgm.lua --replace 'gbsplay' '${gbsplay}/bin/gbsplay'
  '';

  installPhase = ''
    mkdir -p $out/bin
    cp gbs2vgm.lua $out/bin
  '';
}
