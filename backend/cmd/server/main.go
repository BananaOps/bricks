// Command server runs the Bricks roadmap API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/BananaOps/bricks/backend/internal/api"
	"github.com/BananaOps/bricks/backend/internal/config"
	"github.com/BananaOps/bricks/backend/internal/db"
	"github.com/BananaOps/bricks/backend/internal/store"
	"github.com/BananaOps/bricks/backend/internal/web"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if err := run(log); err != nil {
		log.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Signal-aware from the start so a Ctrl-C during a slow first connection
	// still exits promptly.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	startCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	conn, err := db.Open(startCtx, cfg.DatabaseURL, cfg.DatabaseAuthToken)
	if err != nil {
		return err
	}
	defer conn.Close()
	log.Info("database ready", "url", redact(cfg.DatabaseURL))

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.NewServer(store.New(conn), log, cfg.AllowedOrigin, web.Handler(cfg.WebDir, log)).Routes(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", cfg.Addr, "origin", cfg.AllowedOrigin)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		log.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

// redact strips the auth token before a DSN reaches the logs.
func redact(dsn string) string {
	if i := indexOf(dsn, "authToken="); i >= 0 {
		return dsn[:i] + "authToken=***"
	}
	return dsn
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
