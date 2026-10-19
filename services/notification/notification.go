package notification

import (
	"context"
	"fmt"
	"image"
	_ "image/png"
	"os"
	"time"

	"glowsnap/services/settings"

	"github.com/godbus/dbus/v5"
)

const (
	notificationsInterface = "org.freedesktop.Notifications"
	notificationsPath      = "/org/freedesktop/Notifications"
	maxImageSize           = 1024
	sendTimeout            = 10 * time.Second
)

type imageData struct {
	Width         int32
	Height        int32
	Rowstride     int32
	HasAlpha      bool
	BitsPerSample int32
	Channels      int32
	Data          []byte
}

func Send(conn *dbus.Conn, title, body, imagePath string) error {
	if conn == nil {
		fresh, err := dbus.ConnectSessionBus()
		if err != nil {
			return fmt.Errorf("failed to connect to session bus: %w", err)
		}
		defer fresh.Close()
		conn = fresh
	}

	if imagePath != "" {
		if err := send(conn, title, body, buildHints(imagePath)); err == nil {
			return nil
		}
	}
	return send(conn, title, body, map[string]dbus.Variant{})
}

func send(conn *dbus.Conn, title, body string, hints map[string]dbus.Variant) error {
	ctx, cancel := context.WithTimeout(context.Background(), sendTimeout)
	defer cancel()

	obj := conn.Object(notificationsInterface, notificationsPath)
	call := obj.CallWithContext(ctx, notificationsInterface+".Notify", 0,
		settings.AppName,
		uint32(0),
		settings.AppName,
		title,
		body,
		[]string{},
		hints,
		int32(-1),
	)
	if call.Err != nil {
		return call.Err
	}

	var id uint32
	return call.Store(&id)
}

func buildHints(imagePath string) map[string]dbus.Variant {
	hints := map[string]dbus.Variant{}
	if imagePath == "" {
		return hints
	}
	hints["image-path"] = dbus.MakeVariant(imagePath)
	if data, err := buildImageData(imagePath); err == nil {
		hints["image-data"] = dbus.MakeVariant(data)
	}
	return hints
}

func buildImageData(path string) (imageData, error) {
	f, err := os.Open(path)
	if err != nil {
		return imageData{}, err
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		return imageData{}, err
	}

	img = scaleDown(img, maxImageSize)
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	rowstride := width * 4
	data := make([]byte, rowstride*height)

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, b, a := img.At(bounds.Min.X+x, bounds.Min.Y+y).RGBA()
			i := y*rowstride + x*4
			data[i] = byte(r >> 8)
			data[i+1] = byte(g >> 8)
			data[i+2] = byte(b >> 8)
			data[i+3] = byte(a >> 8)
		}
	}

	return imageData{
		Width:         int32(width),
		Height:        int32(height),
		Rowstride:     int32(rowstride),
		HasAlpha:      true,
		BitsPerSample: 8,
		Channels:      4,
		Data:          data,
	}, nil
}

func scaleDown(img image.Image, max int) image.Image {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= max && height <= max {
		return img
	}

	longest := width
	if height > longest {
		longest = height
	}
	scaledWidth := width * max / longest
	scaledHeight := height * max / longest
	if scaledWidth < 1 {
		scaledWidth = 1
	}
	if scaledHeight < 1 {
		scaledHeight = 1
	}

	scaled := image.NewNRGBA(image.Rect(0, 0, scaledWidth, scaledHeight))
	for y := 0; y < scaledHeight; y++ {
		for x := 0; x < scaledWidth; x++ {
			scaled.Set(x, y, img.At(bounds.Min.X+x*width/scaledWidth, bounds.Min.Y+y*height/scaledHeight))
		}
	}
	return scaled
}
