import {
  ClickAwayListener,
  Fade,
  IconButton,
  Paper,
  Popper,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export function RubyEditorPopper(props: {
  anchorEl: HTMLButtonElement | null;
  onClose: () => void;
  onCommit: () => void;
  onConnectSelectedCell: () => void;
  open: boolean;
  rubyInput: string;
  setRubyInput: (rubyInput: string) => void;
}) {
  const {
    anchorEl,
    onClose,
    onCommit,
    onConnectSelectedCell,
    open,
    rubyInput,
    setRubyInput,
  } = props;

  return (
    <Popper
      anchorEl={anchorEl}
      className="ruby-editor-popper"
      open={open && Boolean(anchorEl)}
      placement="top-start"
      transition
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={160}>
          <div className="ruby-editor-transition">
            <ClickAwayListener onClickAway={onClose}>
              <Paper className="ruby-editor-paper" elevation={6} role="dialog">
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TextField
                    autoFocus
                    label="Ruby"
                    onChange={(event) => setRubyInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onCommit();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        onClose();
                      }
                    }}
                    size="small"
                    value={rubyInput}
                  />
                  <Tooltip title="Connect">
                    <IconButton
                      aria-label="Connect"
                      className="ruby-connect-button"
                      onClick={onConnectSelectedCell}
                      size="small"
                    >
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>
            </ClickAwayListener>
          </div>
        </Fade>
      )}
    </Popper>
  );
}
