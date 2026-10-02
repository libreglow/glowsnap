package settings

import "fmt"

const (
	Resolution360p   = "360p"
	Resolution480p   = "480p"
	Resolution720p   = "720p"
	Resolution1080p  = "1080p"
	Resolution1440p  = "1440p"
	Resolution2160p  = "2160p"
	ResolutionCustom = "custom"
)

const DefaultResolution = Resolution1080p

const (
	DefaultCustomWidth  = 1920
	DefaultCustomHeight = 1080
)

const (
	MinCustomWidth  = 16
	MinCustomHeight = 16
	MaxCustomWidth  = 3840
	MaxCustomHeight = 2160
)

type ResolutionPreset struct {
	Value  string `json:"value"`
	Label  string `json:"label"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

var supportedResolutions = []ResolutionPreset{
	{Value: Resolution360p, Label: "360p", Width: 640, Height: 360},
	{Value: Resolution480p, Label: "480p", Width: 854, Height: 480},
	{Value: Resolution720p, Label: "720p", Width: 1280, Height: 720},
	{Value: Resolution1080p, Label: "1080p", Width: 1920, Height: 1080},
	{Value: Resolution1440p, Label: "1440p", Width: 2560, Height: 1440},
	{Value: Resolution2160p, Label: "2160p (4K)", Width: 3840, Height: 2160},
}

type ResolutionLimits struct {
	MinWidth  int `json:"minWidth"`
	MinHeight int `json:"minHeight"`
	MaxWidth  int `json:"maxWidth"`
	MaxHeight int `json:"maxHeight"`
}

func CustomResolutionLimits() ResolutionLimits {
	return ResolutionLimits{
		MinWidth:  MinCustomWidth,
		MinHeight: MinCustomHeight,
		MaxWidth:  MaxCustomWidth,
		MaxHeight: MaxCustomHeight,
	}
}

func SupportedResolutions() []ResolutionPreset {
	out := make([]ResolutionPreset, len(supportedResolutions))
	copy(out, supportedResolutions)
	return out
}

func IsPresetResolution(value string) bool {
	_, _, ok := ResolutionDimensions(value)
	return ok
}

func IsValidResolution(value string) bool {
	return IsCustomResolution(value) || IsPresetResolution(value)
}

func IsCustomResolution(value string) bool {
	return value == ResolutionCustom
}

func ResolutionDimensions(value string) (int, int, bool) {
	for _, r := range supportedResolutions {
		if r.Value == value {
			return r.Width, r.Height, true
		}
	}
	return 0, 0, false
}

func OutputDimensions(value string, customWidth, customHeight int) (int, int, bool) {
	if IsCustomResolution(value) {
		if ValidateCustomResolution(customWidth, customHeight) != nil {
			return 0, 0, false
		}
		return customWidth, customHeight, true
	}
	return ResolutionDimensions(value)
}

func ValidateCustomResolution(width, height int) error {
	if width <= 0 || height <= 0 {
		return fmt.Errorf("width and height must be greater than zero")
	}
	if width%2 != 0 || height%2 != 0 {
		return fmt.Errorf("width and height must be even numbers")
	}
	if width < MinCustomWidth || height < MinCustomHeight {
		return fmt.Errorf("minimum resolution is %d×%d", MinCustomWidth, MinCustomHeight)
	}
	if width > MaxCustomWidth || height > MaxCustomHeight {
		return fmt.Errorf("maximum resolution is %d×%d", MaxCustomWidth, MaxCustomHeight)
	}
	return nil
}

func NormalizeCustomResolution(width, height int) (int, int) {
	if ValidateCustomResolution(width, height) != nil {
		return DefaultCustomWidth, DefaultCustomHeight
	}
	return width, height
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
