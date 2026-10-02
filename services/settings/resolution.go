package settings

const (
	Resolution1080p = "1080p"
	Resolution720p  = "720p"
	Resolution480p  = "480p"
)

const DefaultResolution = Resolution1080p

type ResolutionPreset struct {
	Value  string `json:"value"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

var supportedResolutions = []ResolutionPreset{
	{Value: Resolution1080p, Width: 1920, Height: 1080},
	{Value: Resolution720p, Width: 1280, Height: 720},
	{Value: Resolution480p, Width: 854, Height: 480},
}

func SupportedResolutions() []ResolutionPreset {
	out := make([]ResolutionPreset, len(supportedResolutions))
	copy(out, supportedResolutions)
	return out
}

func IsValidResolution(value string) bool {
	_, _, ok := ResolutionDimensions(value)
	return ok
}

func ResolutionDimensions(value string) (int, int, bool) {
	for _, r := range supportedResolutions {
		if r.Value == value {
			return r.Width, r.Height, true
		}
	}
	return 0, 0, false
}

func legacyQualityResolution(quality string) (string, bool) {
	switch quality {
	case "high":
		return Resolution1080p, true
	case "medium":
		return Resolution720p, true
	case "low":
		return Resolution480p, true
	}
	return "", false
}
