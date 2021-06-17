{ stdenv, fetchFromGitHub, libpulseaudio }: stdenv.mkDerivation rec {
  pname = "gbsplay";
  version = "0.0.94";

  src = fetchFromGitHub {
    owner = "mmitch";
    repo = "gbsplay";
    rev = version;
    sha256 = "VpaXbjotmc/Ref1geiKkBX9UhbPxfAGkFAdKVxP8Uxo=";
  };

  configureFlags = [ "--without-test" ];

  buildInputs = [ libpulseaudio ];
}
